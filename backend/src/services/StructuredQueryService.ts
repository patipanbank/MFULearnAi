/**
 * StructuredQueryService — Tiered query engine for structured (tabular) knowledge.
 *
 * Architecture:
 *   When knowledge is detected as structured (CSV, XLSX, Google Sheets),
 *   the worker stores parsed rows as JSON in `structuredData`.
 *   This service queries that JSON using a tiered strategy:
 *
 *   1. inject   (≤8000 cells)   → Format entire table as Markdown for context injection
 *   2. tool_lookup (≤40000 cells) → In-memory filter/match on MongoDB-loaded JSON rows
 *   3. indexed_lookup (>40000)    → MongoDB aggregation pipeline with text matching
 *
 * Permission model:
 *   Respects collection scope (collectionId → knowledgeIds) and user ownership/department.
 *   Same access rules as vector search in KnowledgeService.
 */

import { Knowledge, Collection, IKnowledge } from '../knowledge/models';
import { formatForContextInjection, determineQueryStrategy } from '../knowledge/structuredDetector';
import { LoggerService } from './LoggerService';

// ── Constants ──
const MAX_RETURN_ROWS = 30;               // Max rows returned from tool_lookup
const INJECT_MAX_CHARS = 15_000;           // Max chars for context injection markdown (≈4k tokens)
const FUZZY_THRESHOLD = 0.6;              // Minimum fuzzy match score (0-1)

export interface StructuredQueryOptions {
    collectionId?: string;
    knowledgeId?: string;              // Optional: target specific KB
    userId: string;
    role: string;
    department?: string;
    allowedDepartments?: string[];
    allowedKnowledgeIds?: string[];
    column?: string;                   // Optional: target specific column
    limit?: number;
}

export interface StructuredQueryResult {
    strategy: 'inject' | 'tool_lookup' | 'indexed_lookup' | 'none';
    matchedRows: Array<Record<string, unknown>>;
    totalCandidates: number;
    matchedOn?: string;                // Column or match description
    source: string;                    // Knowledge title / source
    knowledgeId: string;
    headers: string[];
    markdown?: string;                 // For inject strategy
}

export class StructuredQueryService {

    /**
     * Query structured knowledge by natural language query.
     * Automatically resolves strategy and filters by permissions.
     */
    static async query(
        query: string,
        options: StructuredQueryOptions
    ): Promise<StructuredQueryResult[]> {
        const results: StructuredQueryResult[] = [];

        try {
            // 1. Resolve which Knowledge docs to search
            const kbDocs = await this.resolveStructuredKnowledge(options);

            if (kbDocs.length === 0) {
                return [{
                    strategy: 'none',
                    matchedRows: [],
                    totalCandidates: 0,
                    source: '',
                    knowledgeId: '',
                    headers: []
                }];
            }

            // 2. Query each structured KB
            for (const kb of kbDocs) {
                const strategy = kb.structuredMeta
                    ? determineQueryStrategy(kb.structuredMeta as any)
                    : 'tool_lookup';

                const result = await this.queryKnowledge(query, kb, strategy, options);
                if (result) {
                    results.push(result);
                }
            }

            return results.length > 0 ? results : [{
                strategy: 'none',
                matchedRows: [],
                totalCandidates: 0,
                source: '',
                knowledgeId: '',
                headers: []
            }];

        } catch (error: any) {
            LoggerService.error('structured_query_error', { error: error.message, query });
            return [{
                strategy: 'none',
                matchedRows: [],
                totalCandidates: 0,
                source: '',
                knowledgeId: '',
                headers: [],
            }];
        }
    }

    /**
     * Get injectable Markdown for small structured tables (inject strategy).
     * Returns null if no injectable structured data exists for the collection.
     */
    static async getInjectableContext(
        collectionId: string,
        userId: string,
        role: string,
        department?: string
    ): Promise<string | null> {
        const kbDocs = await this.resolveStructuredKnowledge({
            collectionId,
            userId,
            role,
            department
        });

        const injectParts: string[] = [];

        for (const kb of kbDocs) {
            if (!kb.structuredMeta || !kb.structuredData) continue;

            const strategy = determineQueryStrategy(kb.structuredMeta as any);
            if (strategy !== 'inject') continue;

            const rows = kb.structuredData as Array<Record<string, string>>;
            const headers = kb.structuredMeta.headers || [];
            const sheetNames = kb.structuredMeta.sheetNames || [];

            const md = formatForContextInjection(rows, headers, sheetNames);
            if (md) {
                injectParts.push(`## ${kb.title}\n${md}`);
            }
        }

        if (injectParts.length === 0) return null;

        const combined = injectParts.join('\n\n');
        // Truncate if too large
        return combined.length > INJECT_MAX_CHARS
            ? combined.substring(0, INJECT_MAX_CHARS) + '\n\n... (truncated)'
            : combined;
    }

    /**
     * Check if a collection has any structured knowledge that needs tool_lookup or indexed_lookup.
     * Used by AgentWorkflow to decide whether to inject TableLookupTool.
     */
    static async collectionHasLookupStructuredData(
        collectionId: string
    ): Promise<boolean> {
        // Find knowledge IDs in this collection
        const col = await Collection.findById(collectionId);
        if (!col) return false;

        // Check if any KB in the collection has structured data with non-inject strategy
        const kbs = await Knowledge.find({
            _id: { $in: col.knowledgeIds },
            visibility: 'active',
            processingStatus: 'completed',
            dataFormat: { $in: ['structured', 'hybrid'] }
        }).select('structuredMeta').lean();

        for (const kb of kbs) {
            if (kb.structuredMeta) {
                const strategy = determineQueryStrategy(kb.structuredMeta as any);
                if (strategy === 'tool_lookup' || strategy === 'indexed_lookup') {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a collection has any injectable (small) structured KBs.
     */
    static async collectionHasInjectableData(
        collectionId: string
    ): Promise<boolean> {
        const col = await Collection.findById(collectionId);
        if (!col) return false;

        const kbs = await Knowledge.find({
            _id: { $in: col.knowledgeIds },
            visibility: 'active',
            processingStatus: 'completed',
            dataFormat: { $in: ['structured', 'hybrid'] }
        }).select('structuredMeta').lean();

        for (const kb of kbs) {
            if (kb.structuredMeta) {
                const strategy = determineQueryStrategy(kb.structuredMeta as any);
                if (strategy === 'inject') return true;
            }
        }
        return false;
    }

    // ── Private helpers ──

    /**
     * Resolve which Knowledge documents to search, respecting collection scope + permissions.
     */
    private static async resolveStructuredKnowledge(
        options: StructuredQueryOptions
    ): Promise<IKnowledge[]> {
        const filter: any = {
            visibility: 'active',
            processingStatus: 'completed',
            dataFormat: { $in: ['structured', 'hybrid'] },
            structuredData: { $exists: true, $ne: null }
        };

        // Target specific KB
        if (options.knowledgeId) {
            filter._id = options.knowledgeId;
        }

        // Collection scope: restrict to IDs in the collection + default collections
        if (options.collectionId) {
            const allowedIds = new Set<string>();

            const targetCol = await Collection.findById(options.collectionId);
            if (targetCol) {
                targetCol.knowledgeIds.forEach((kid: any) => allowedIds.add(kid.toString()));
            }

            // Also include default collections (system-wide)
            const defaultCols = await Collection.find({ type: 'default' });
            defaultCols.forEach(col => {
                col.knowledgeIds.forEach((kid: any) => allowedIds.add(kid.toString()));
            });

            if (allowedIds.size > 0) {
                filter._id = { ...filter._id, $in: Array.from(allowedIds) };
            }
        }

        // API Key KB restrictions
        if (options.allowedKnowledgeIds && options.allowedKnowledgeIds.length > 0) {
            const apiScope = options.allowedKnowledgeIds;
            if (filter._id?.$in) {
                // Intersect with collection scope
                filter._id.$in = filter._id.$in.filter((id: string) => apiScope.includes(id));
            } else {
                filter._id = { ...filter._id, $in: apiScope };
            }
        }

        // Permission: user can see own + public + department KBs
        // Admin/superadmin can see all
        if (options.role !== 'admin' && options.role !== 'superadmin') {
            filter.$or = [
                { ownerId: options.userId },
                { type: 'public' },
                { type: 'policy' },
                ...(options.department ? [{ type: 'department', department: options.department }] : []),
                ...(options.allowedDepartments
                    ? options.allowedDepartments.map(d => ({ type: 'department', department: d }))
                    : [])
            ];
        }

        return Knowledge.find(filter)
            .select('title contentSource structuredData structuredMeta dataFormat type department ownerId')
            .lean() as unknown as IKnowledge[];
    }

    /**
     * Query a single Knowledge document's structured data.
     */
    private static async queryKnowledge(
        query: string,
        kb: IKnowledge,
        strategy: string,
        options: StructuredQueryOptions
    ): Promise<StructuredQueryResult | null> {
        const rows = kb.structuredData as Array<Record<string, string>> | undefined;
        const meta = kb.structuredMeta;
        if (!rows || rows.length === 0 || !meta) return null;

        const headers = meta.headers || Object.keys(rows[0] || {});
        const limit = options.limit || MAX_RETURN_ROWS;

        switch (strategy) {
            case 'inject':
                return {
                    strategy: 'inject',
                    matchedRows: rows,
                    totalCandidates: rows.length,
                    source: kb.title || kb.contentSource || 'Unknown',
                    knowledgeId: (kb._id as any).toString(),
                    headers,
                    markdown: formatForContextInjection(rows, headers, meta.sheetNames || [])
                };

            case 'tool_lookup':
                return this.inMemoryLookup(query, rows, headers, kb, limit, options.column);

            case 'indexed_lookup':
                return this.indexedLookup(query, kb, headers, limit, options.column);

            default:
                return this.inMemoryLookup(query, rows, headers, kb, limit, options.column);
        }
    }

    /**
     * In-memory multi-strategy search across JSON rows.
     * Strategy order: exact → prefix → contains → fuzzy
     */
    private static inMemoryLookup(
        query: string,
        rows: Array<Record<string, string>>,
        headers: string[],
        kb: IKnowledge,
        limit: number,
        targetColumn?: string
    ): StructuredQueryResult {
        const q = query.toLowerCase().trim();
        const queryTokens = q.split(/\s+/).filter(t => t.length > 1);

        // Determine which columns to search
        const searchCols = targetColumn
            ? headers.filter(h => h.toLowerCase() === targetColumn.toLowerCase())
            : headers;

        if (searchCols.length === 0) {
            return {
                strategy: 'tool_lookup',
                matchedRows: [],
                totalCandidates: rows.length,
                source: kb.title || 'Unknown',
                knowledgeId: (kb._id as any).toString(),
                headers,
                matchedOn: `Column "${targetColumn}" not found`
            };
        }

        // Score each row
        const scored: Array<{ row: Record<string, string>; score: number; matchedCol: string }> = [];

        for (const row of rows) {
            let bestScore = 0;
            let matchedCol = '';

            for (const col of searchCols) {
                const cellValue = String(row[col] || '').toLowerCase();
                if (!cellValue) continue;

                let score = 0;

                // Exact match (highest)
                if (cellValue === q) {
                    score = 1.0;
                }
                // Starts with query
                else if (cellValue.startsWith(q)) {
                    score = 0.9;
                }
                // Contains query as substring
                else if (cellValue.includes(q)) {
                    score = 0.8;
                }
                // All tokens found in cell
                else if (queryTokens.length > 1 && queryTokens.every(t => cellValue.includes(t))) {
                    score = 0.7;
                }
                // Some tokens found
                else if (queryTokens.length > 0) {
                    const matchCount = queryTokens.filter(t => cellValue.includes(t)).length;
                    const tokenScore = matchCount / queryTokens.length;
                    if (tokenScore >= FUZZY_THRESHOLD) {
                        score = 0.4 + (tokenScore * 0.3); // 0.4 - 0.7 range
                    }
                }
                // Levenshtein for short queries (≤15 chars)
                else if (q.length <= 15 && cellValue.length <= 50) {
                    const dist = this.levenshtein(q, cellValue);
                    const maxLen = Math.max(q.length, cellValue.length);
                    const similarity = 1 - (dist / maxLen);
                    if (similarity >= FUZZY_THRESHOLD) {
                        score = similarity * 0.5;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    matchedCol = col;
                }
            }

            if (bestScore > 0) {
                scored.push({ row, score: bestScore, matchedCol });
            }
        }

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);
        const topResults = scored.slice(0, limit);

        // Determine primaryMatchedCol
        const colCounts = new Map<string, number>();
        topResults.forEach(r => colCounts.set(r.matchedCol, (colCounts.get(r.matchedCol) || 0) + 1));
        let primaryCol = '';
        let maxCount = 0;
        colCounts.forEach((count, col) => { if (count > maxCount) { maxCount = count; primaryCol = col; } });

        return {
            strategy: 'tool_lookup',
            matchedRows: topResults.map(r => r.row),
            totalCandidates: rows.length,
            matchedOn: primaryCol || (searchCols.length === 1 ? searchCols[0] : 'multiple columns'),
            source: kb.title || kb.contentSource || 'Unknown',
            knowledgeId: (kb._id as any).toString(),
            headers
        };
    }

    /**
     * Indexed lookup using MongoDB aggregation for very large tables.
     * Falls back to in-memory if structuredData is embedded (not externalized).
     */
    private static async indexedLookup(
        query: string,
        kb: IKnowledge,
        headers: string[],
        limit: number,
        targetColumn?: string
    ): Promise<StructuredQueryResult> {
        // For now, large tables still use structuredData from MongoDB.
        // Future: externalize to a dedicated collection for better indexing.
        const fullKb = await Knowledge.findById(kb._id).select('structuredData structuredMeta title contentSource').lean();
        const rows = (fullKb?.structuredData as Array<Record<string, string>>) || [];

        if (rows.length === 0) {
            return {
                strategy: 'indexed_lookup',
                matchedRows: [],
                totalCandidates: 0,
                source: kb.title || 'Unknown',
                knowledgeId: (kb._id as any).toString(),
                headers
            };
        }

        // Use in-memory for now (MongoDB $elemMatch doesn't work well on dynamic keys)
        // TODO: For truly large datasets, externalize rows to a StructuredRow collection
        return this.inMemoryLookup(query, rows, headers, kb, limit, targetColumn);
    }

    /**
     * Simple Levenshtein distance for fuzzy matching short strings.
     */
    private static levenshtein(a: string, b: string): number {
        const m = a.length, n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;

        const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }

        return dp[m][n];
    }
}
