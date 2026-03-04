/**
 * TableLookupTool — Agent tool for querying structured (tabular) knowledge.
 *
 * This tool is conditionally injected into the agent's tool set ONLY when
 * the active collection contains structured knowledge items that require
 * tool_lookup or indexed_lookup strategy (medium/large tables).
 *
 * Small tables (inject strategy) are instead injected directly into the
 * system prompt as Markdown — no tool needed.
 *
 * The LLM decides when to use this tool based on the query context,
 * e.g. "ค้นหาข้อมูลนักศึกษา", "find the row for product X", "list all entries where...".
 */

import { AgentTool, ToolExecutionContext, ToolResult, ToolSchemaJSON } from './AgentTool';
import { StructuredQueryService } from '../services/StructuredQueryService';

export class TableLookupTool extends AgentTool {
    name = 'lookup_knowledge_table';
    description = 'Search structured data tables (spreadsheets, CSV) in the knowledge base. Use when looking up specific rows, filtering by column values, or finding data in tabular formats.';
    allowedRoles = ['*'];

    schemaJSON: ToolSchemaJSON = {
        name: 'lookup_knowledge_table',
        description: 'Search structured data tables (spreadsheets, CSV) for specific entries. Returns matching rows from tabular knowledge.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query — a value, name, ID, or keyword to find in the table.'
                    },
                    column: {
                        type: 'string',
                        description: 'Optional: target a specific column name to search within (e.g. "ชื่อ", "email", "รหัส").'
                    },
                    knowledge_id: {
                        type: 'string',
                        description: 'Optional: target a specific knowledge item by ID. Omit to search all structured tables in the collection.'
                    }
                },
                required: ['query']
            }
        }
    };

    async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
        try {
            const query = String(args.query || '').trim();
            if (!query) {
                return { success: false, result: null, error: 'Query is required.' };
            }

            const column = args.column ? String(args.column).trim() : undefined;
            const knowledgeId = args.knowledge_id ? String(args.knowledge_id).trim() : undefined;

            const results = await StructuredQueryService.query(query, {
                collectionId: context.collectionId,
                knowledgeId,
                userId: context.userId,
                role: context.role || 'student',
                department: context.department,
                allowedDepartments: context.allowedDepartments,
                allowedKnowledgeIds: context.allowedKnowledgeIds,
                column,
                limit: 30
            });

            // Aggregate results from all matching KBs
            if (results.length === 0 || (results.length === 1 && results[0].strategy === 'none')) {
                return {
                    success: true,
                    result: 'No structured data tables found in the current knowledge scope.'
                };
            }

            // Format results for LLM consumption
            const formatted = results.map(r => {
                if (r.matchedRows.length === 0) {
                    return `[${r.source}] No matching rows found (searched ${r.totalCandidates} rows).`;
                }

                const headerLine = r.headers.join(' | ');
                const separator = r.headers.map(() => '---').join(' | ');
                const dataLines = r.matchedRows.map(row =>
                    r.headers.map(h => String((row as any)[h] || '')).join(' | ')
                );

                const parts = [
                    `**Source: ${r.source}** (${r.matchedRows.length} of ${r.totalCandidates} rows)`,
                    r.matchedOn ? `Matched on: ${r.matchedOn}` : '',
                    '',
                    `| ${headerLine} |`,
                    `| ${separator} |`,
                    ...dataLines.map(line => `| ${line} |`),
                ].filter(Boolean);

                return parts.join('\n');
            });

            return {
                success: true,
                result: formatted.join('\n\n---\n\n')
            };
        } catch (error: any) {
            return {
                success: false,
                result: null,
                error: `Structured data lookup failed: ${error.message}`
            };
        }
    }
}
