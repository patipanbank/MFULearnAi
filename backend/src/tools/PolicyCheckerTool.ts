import { AgentTool, AgentContext, ToolResult } from './AgentTool';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SYSTEM_MODELS } from '../config/models';

/**
 * PolicyCheckerTool — Agent tool for checking policy compliance.
 *
 * Searches ALL policy documents in the Knowledge Base (KB) —
 * not just university rules, but any policy admins have uploaded:
 * PDPA, data protection, academic regulations, HR policies, etc.
 *
 * Architecture: Agent decides when to call this tool.
 * Internally: RAG retrieval → LLM compliance check → structured result.
 */

/** Severity levels for policy check results */
type PolicySeverity = 'PASS' | 'WARN' | 'BLOCK';

/** Structured result from the compliance check LLM */
interface ComplianceResult {
    severity: PolicySeverity;
    answer: string;
    relevantPolicies: Array<{ source: string; excerpt: string }>;
    reason: string;
}

/** Score threshold below which policy results are considered irrelevant */
const MIN_POLICY_SCORE = 0.50;

const COMPLIANCE_CHECK_PROMPT = `You are a policy compliance checker.

User's question or action: {query}

Retrieved policy documents from our Knowledge Base:
{policies}

Task:
1. Determine if any of the retrieved policies are relevant to the user's question or action.
2. If relevant policies are found, answer the question BASED ONLY on the policy content.
3. Classify the severity:
   - PASS: The question is answered by the policies, or the action is allowed under these policies.
   - WARN: The action may have restrictions or conditions under the relevant policies — inform the user.
   - BLOCK: The action clearly violates one or more policies — explain which policy and why.

IMPORTANT:
- These policies may cover ANY domain: data protection (PDPA), organizational rules, academic regulations, HR policies, legal compliance, etc.
- Do NOT limit your analysis to only one type of policy. Check ALL retrieved documents.
- Answer in the SAME LANGUAGE as the user's question.
- If the retrieved policies do NOT contain relevant information, return severity "PASS" with answer stating no relevant policy was found.
- Always cite the source document name when referencing a policy.

Return ONLY valid JSON (no markdown, no code fences):
{
  "severity": "PASS" | "WARN" | "BLOCK",
  "answer": "คำตอบหรือคำอธิบาย...",
  "relevantPolicies": [
    { "source": "ชื่อเอกสาร", "excerpt": "ข้อความที่เกี่ยวข้อง" }
  ],
  "reason": "เหตุผลสั้นๆ"
}`;

export class PolicyCheckerTool extends AgentTool {
    name = 'check_policy';
    description = 'Search and check against all policy documents in the Knowledge Base. This includes any policies uploaded by admins: PDPA, data protection, organizational rules, academic regulations, HR policies, disciplinary rules, legal compliance, and more. Use this whenever the question may relate to rules, regulations, compliance, or official procedures of any kind.';
    allowedRoles = ['*'];

    schemaJSON = {
        name: 'check_policy',
        description: 'Search and check against all policy documents in the Knowledge Base for compliance. Covers all policy domains: PDPA, organizational rules, academic regulations, HR policies, and more.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The question or action to check against policies in the Knowledge Base.'
                    },
                    context: {
                        type: 'string',
                        description: 'Optional additional context about the situation.'
                    }
                },
                required: ['query']
            }
        }
    };

    async execute(args: any, context: AgentContext): Promise<ToolResult> {
        const { query, context: additionalContext } = args;

        try {
            // Step 1: RAG — Retrieve relevant policy documents from KB
            const userContext = {
                userId: context.userId,
                role: context.role || 'student',
                department: context.department || 'General'
            };

            const expandedQuery = additionalContext
                ? `${query} ${additionalContext}`
                : query;

            const { text: ragText, blocks, sources, maxScore } = await KnowledgeService.search(
                expandedQuery,
                userContext,
                {
                    minScore: MIN_POLICY_SCORE,
                    intent: 'POLICY_CHECK',
                    metadataFilter: { type: 'policy' }
                }
            );

            LoggerService.info('policy_checker_rag', {
                query,
                maxScore,
                blockCount: blocks.length
            });

            // No relevant policies found — return PASS immediately (no LLM needed)
            if (!ragText || blocks.length === 0 || maxScore < MIN_POLICY_SCORE) {
                return {
                    success: true,
                    result: JSON.stringify({
                        severity: 'PASS',
                        answer: 'ไม่พบนโยบายหรือระเบียบที่เกี่ยวข้องกับคำถามนี้ในฐานข้อมูล',
                        relevantPolicies: [],
                        reason: 'No matching policy documents found in KB'
                    } satisfies ComplianceResult)
                };
            }

            // Step 2: LLM Compliance Check — Use lightweight model for speed
            const policyTexts = blocks.map((b: any, i: number) => {
                const source = b.metadata?.fileName || 'Unknown';
                return `[${i + 1}] Source: ${source}\n${b.content}`;
            }).join('\n\n---\n\n');

            const prompt = COMPLIANCE_CHECK_PROMPT
                .replace('{query}', query)
                .replace('{policies}', policyTexts);

            const { text: llmResponse } = await BedrockService.sendChat(
                SYSTEM_MODELS.RERANK,
                [{ role: 'user', content: prompt }],
                undefined,
                0.1
            );

            LoggerService.info('policy_checker_compliance', {
                query,
                model: SYSTEM_MODELS.RERANK,
                maxScore
            });

            // Step 3: Parse LLM response
            const complianceResult = this.parseComplianceResult(llmResponse, sources);

            return {
                success: true,
                result: JSON.stringify(complianceResult)
            };

        } catch (error: any) {
            LoggerService.error('policy_checker_error', { error: error.message, query });
            return {
                success: false,
                result: null,
                error: `Policy check failed: ${error.message}`
            };
        }
    }

    /**
     * Parse the LLM compliance check response into a structured result.
     * Handles malformed JSON gracefully.
     */
    private parseComplianceResult(
        llmResponse: string,
        sources: Array<{ id: string; name: string }>
    ): ComplianceResult {
        try {
            // Strip markdown code fences if present
            const cleaned = llmResponse
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            const parsed = JSON.parse(cleaned);

            return {
                severity: (['PASS', 'WARN', 'BLOCK'].includes(parsed.severity))
                    ? parsed.severity
                    : 'PASS',
                answer: parsed.answer || 'ไม่สามารถวิเคราะห์ได้',
                relevantPolicies: Array.isArray(parsed.relevantPolicies)
                    ? parsed.relevantPolicies
                    : [],
                reason: parsed.reason || ''
            };
        } catch {
            LoggerService.warn('policy_checker_parse_fallback', {
                rawLength: llmResponse.length
            });

            return {
                severity: 'PASS',
                answer: llmResponse.trim(),
                relevantPolicies: sources.map(s => ({
                    source: s.name,
                    excerpt: ''
                })),
                reason: 'LLM response could not be parsed as structured JSON'
            };
        }
    }
}
