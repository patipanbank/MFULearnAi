import { AgentTool, ToolExecutionContext, ToolResult } from './AgentTool';
import { KnowledgeService } from '../services/KnowledgeService';
import { QueryRewriterService } from '../services/QueryRewriterService';
import { LoggerService } from '../services/LoggerService';

export class SearchTool extends AgentTool {
    name = 'search';
    description = 'Search the knowledge base for information about the system, documents, or general facts.';
    allowedRoles = ['*'];

    // Native JSON Schema for Bedrock/Claude 3.5
    schemaJSON = {
        name: 'search',
        description: 'Search internal documents and knowledge base.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query.'
                    },
                    context: {
                        type: 'string',
                        description: 'Additional context to refine the search (e.g., specific terms, policy names).'
                    }
                },
                required: ['query'],
                additionalProperties: false,
            }
        }
    };

    async execute(args: any, context: ToolExecutionContext): Promise<ToolResult> {
        try {
            const { query, context: queryContext } = args;

            // Step 1: LLM Query Rewriting (Qwen) — expand, clarify, normalize
            const rewriteResult = await QueryRewriterService.rewrite(query, queryContext);

            LoggerService.info('search_tool_query_rewrite', {
                originalQuery: query,
                rewrittenQuery: rewriteResult.rewrittenQuery,
                subQueries: rewriteResult.subQueries,
                wasRewritten: rewriteResult.wasRewritten,
                latencyMs: rewriteResult.latencyMs,
            });

            const userContext = {
                userId: context.userId,
                role: context.role || 'student',
                department: context.department || 'General',
                allowedDepartments: context.allowedDepartments,
                allowedKnowledgeIds: context.allowedKnowledgeIds,
            };

            const searchOpts = {
                collectionId: context.collectionId,
                metadataFilter: { type: { $ne: 'policy' } } // Exclude policies
            };

            // Step 2: Primary search with rewritten query
            const { text, sources, blocks } = await KnowledgeService.search(
                rewriteResult.rewrittenQuery,
                userContext,
                searchOpts
            );

            // Step 3: Multi-query retrieval — run sub-queries if primary results are thin
            let allBlocks = blocks || [];
            let allSources = sources || [];
            if (allBlocks.length < 3 && rewriteResult.subQueries.length > 0) {
                const seenIds = new Set(allBlocks.map((b: any) => b.id));

                for (const subQuery of rewriteResult.subQueries) {
                    try {
                        const sub = await KnowledgeService.search(subQuery, userContext, searchOpts);
                        for (const block of (sub.blocks || [])) {
                            const blockId = block.id;
                            if (!seenIds.has(blockId)) {
                                seenIds.add(blockId);
                                allBlocks.push(block);
                            }
                        }
                        for (const src of (sub.sources || [])) {
                            if (!allSources.find((s: any) => s.id === src.id)) {
                                allSources.push(src);
                            }
                        }
                    } catch {
                        // Sub-query failure is non-critical
                    }
                }
            }

            if (!text && allBlocks.length === 0) {
                return { success: true, result: "No relevant information found in the knowledge base." };
            }

            // Return formatted text + sources for citation
            let result = text;
            if (allSources.length > 0) {
                const sourceList = allSources.map((s: any) => `- [${s.id}] ${s.name}`).join('\n');
                result += `\n\n=== SOURCES ===\n${sourceList}`;
            }

            return { success: true, result: result };
        } catch (error: any) {
            return { success: false, result: null, error: error.message };
        }
    }
}
