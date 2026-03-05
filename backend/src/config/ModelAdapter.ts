/**
 * ModelAdapter — Enterprise Model Abstraction Layer
 * 
 * Different LLM families (Nova, Claude, Mistral) have vastly different behaviors:
 *   - Tool calling quality, argument formatting
 *   - Internal reasoning language (Nova defaults to English thinking)
 *   - System prompt interpretation style
 *   - Structured output capabilities
 * 
 * This adapter provides model-specific directives so the agent loop, prompt builder,
 * and tool executor can adjust behavior without hard-coding model checks everywhere.
 * 
 * When Claude becomes available: just change SYSTEM_MODELS.AGENT — the adapter auto-selects.
 */

// ── Model Family Detection ──────────────────────────────────────────────────

export type ModelFamily = 'nova' | 'claude' | 'mistral' | 'qwen' | 'unknown';

export function detectModelFamily(modelId: string): ModelFamily {
    if (modelId.startsWith('amazon.nova')) return 'nova';
    if (modelId.startsWith('anthropic.claude')) return 'claude';
    if (modelId.startsWith('mistral.')) return 'mistral';
    if (modelId.startsWith('qwen.')) return 'qwen';
    return 'unknown';
}

// ── Adapter Interface ───────────────────────────────────────────────────────

export interface ModelAdapterConfig {
    /** Model family identifier */
    family: ModelFamily;

    /** 
     * Directive injected at the TOP of the system prompt. 
     * Forces reasoning/planning in Thai for models that default to English thinking. 
     */
    thinkingDirective: string;

    /**
     * Tool calling enhancement block — explicit decision tree and few-shot examples.
     * Compensates for models with weaker tool selection ability.
     */
    toolCallingDirective: string;

    /**
     * Output format directive — how to structure the final answer.
     * Some models need explicit formatting instructions.
     */
    outputDirective: string;

    /**
     * Temperature override hint. Nova benefits from lower temperature for tool calling.
     * null = use default (0.5).
     */
    recommendedTemperature: number | null;

    /**
     * Whether this model supports native prompt caching (Bedrock cachePoint).
     */
    supportsCaching: boolean;

    /**
     * Maximum tool description length before summarization.
     * Weaker models get confused by long descriptions.
     */
    maxToolDescriptionLength: number;

    /**
     * Whether to inject step-by-step reasoning scaffolding.
     * Helps weaker models plan before acting.
     */
    injectReasoningScaffold: boolean;
}

// ── Per-Family Configurations ───────────────────────────────────────────────

const NOVA_ADAPTER: ModelAdapterConfig = {
    family: 'nova',

    thinkingDirective: `=== LANGUAGE & REASONING DIRECTIVE ===
Auto-detect the user's language and respond in the SAME language.
- If the user writes in Thai → think, plan, and answer in Thai
- If the user writes in English → think, plan, and answer in English
- If the user mixes languages → respond in the primary language of their message
- Tool arguments (query/context): use the same language as the user's question
- Technical terms can remain in English regardless of language`,

    toolCallingDirective: `=== TOOL SELECTION DECISION TREE ===
When you receive a question, decide in this order:

Step 1: Classify the question
  → Rules, regulations, policies, PDPA, rights, penalties → check_policy
  → Facts, news, systems, people, places → search
  → Numbers, calculations, statistics → calculator
  → Lists, tables, structured data → lookup_knowledge_table
  → Not enough info / ambiguous → ask_user (ask for clarification first)
  → General chat, greetings, no data needed → answer directly, no tool needed

Step 2: Write a good query
  → Use the SAME language as the user's question, concise and to the point
  → Do NOT add "ในมหาวิทยาลัย" or "at MFU" to the query

Step 3: Use exactly ONE tool — the most relevant one
  → Do NOT call search + check_policy simultaneously for the same question
  → If unsure whether it's policy or general info → use check_policy first

=== TOOL CALL EXAMPLES ===

Example 1 — Thai question, general search:
  User: "คณะวิทย์มีสาขาอะไรบ้าง"
  → tool: search, args: {"query": "สาขาวิชาในคณะวิทยาศาสตร์"}

Example 2 — English question, policy check:
  User: "How many sick days am I allowed?"
  → tool: check_policy, args: {"query": "number of allowed sick leave days"}

Example 3 — Thai question, calculation:
  User: "3000 บวก 1500 เท่าไหร่"
  → tool: calculator, args: {"operation": "add", "a": 3000, "b": 1500}

Example 4 — Not enough info, ask back:
  User: "ช่วยค้นหาให้หน่อย"
  → tool: ask_user, args: {"question": "ต้องการค้นหาข้อมูลเกี่ยวกับเรื่องอะไรครับ?", "reason": "ผู้ใช้ไม่ได้ระบุหัวข้อที่ต้องการค้นหา"}

Example 5 — English question, ask back:
  User: "Can you look something up?"
  → tool: ask_user, args: {"question": "What topic would you like me to search for?", "reason": "User did not specify a search topic"}

=== CRITICAL RULES ===
- Do NOT guess argument values not present in the user's question
- If unsure about an argument value → use ask_user to ask first
- Do NOT add fields not in the tool's schema
- Query must be in the SAME language as the user's question, short and precise`,

    outputDirective: `=== OUTPUT FORMAT ===
- Answer the question directly first, then provide details
- Use bullet points when there are multiple items
- Always cite sources from tool results
- Do NOT say "I will search for you" — just do it
- Respond in the SAME language the user used`,

    recommendedTemperature: 0.3,  // Lower temp = more deterministic tool selection
    supportsCaching: true,   // Nova supports system prompt caching (GA April 2025)
    maxToolDescriptionLength: 200,
    injectReasoningScaffold: true,
};

const CLAUDE_ADAPTER: ModelAdapterConfig = {
    family: 'claude',

    thinkingDirective: `=== LANGUAGE DIRECTIVE ===
Auto-detect the user's language. Respond in the same language the user writes in.
Use English for technical terms regardless of language.`,

    toolCallingDirective: '', // Claude is naturally good at tool selection — minimal hints needed

    outputDirective: `=== OUTPUT ===
Be concise and to the point. Cite sources. Respond in the user's language.`,

    recommendedTemperature: null, // Use default
    supportsCaching: true,
    maxToolDescriptionLength: 500,
    injectReasoningScaffold: false, // Claude reasons well natively
};

const MISTRAL_ADAPTER: ModelAdapterConfig = {
    family: 'mistral',

    thinkingDirective: `=== LANGUAGE & REASONING DIRECTIVE ===
Auto-detect the user's language. Think, plan, and answer in the same language.
Use English only for technical terms.`,

    toolCallingDirective: `=== TOOL USAGE ===
Choose the single most appropriate tool per question. Use the same language as the user in queries.`,

    outputDirective: `=== OUTPUT ===
Respond in the user's language. Be concise and to the point.`,

    recommendedTemperature: 0.4,
    supportsCaching: false,
    maxToolDescriptionLength: 300,
    injectReasoningScaffold: false,
};

const DEFAULT_ADAPTER: ModelAdapterConfig = {
    family: 'unknown',
    thinkingDirective: 'Auto-detect the user\'s language and respond in the same language.',
    toolCallingDirective: '',
    outputDirective: '',
    recommendedTemperature: null,
    supportsCaching: false,
    maxToolDescriptionLength: 300,
    injectReasoningScaffold: false,
};

// ── Adapter Registry ────────────────────────────────────────────────────────

const ADAPTER_REGISTRY: Record<ModelFamily, ModelAdapterConfig> = {
    nova: NOVA_ADAPTER,
    claude: CLAUDE_ADAPTER,
    mistral: MISTRAL_ADAPTER,
    qwen: MISTRAL_ADAPTER,   // Qwen follows similar patterns to Mistral
    unknown: DEFAULT_ADAPTER,
};

/**
 * Get the adapter configuration for a given Bedrock model ID.
 * This is the main public API — used by PromptBuilder, AgentWorkflow, etc.
 */
export function getModelAdapter(modelId: string): ModelAdapterConfig {
    const family = detectModelFamily(modelId);
    return ADAPTER_REGISTRY[family];
}

/**
 * Build the complete model-specific system prompt prefix.
 * Called by PromptBuilder to prepend before the persona prompt.
 */
export function buildModelDirectives(modelId: string): string {
    const adapter = getModelAdapter(modelId);
    const parts: string[] = [];

    if (adapter.thinkingDirective) parts.push(adapter.thinkingDirective);
    if (adapter.toolCallingDirective) parts.push(adapter.toolCallingDirective);
    if (adapter.outputDirective) parts.push(adapter.outputDirective);

    // Reasoning scaffold for weaker models
    if (adapter.injectReasoningScaffold) {
        parts.push(`=== STEP-BY-STEP REASONING ===
Always plan briefly before acting:
1. Understand the question (What does the user need?)
2. Choose the right tool (or answer directly if no tool is needed)
3. Write a precise query in the user's language
4. Analyze tool results and answer in the user's language`);
    }

    return parts.join('\n\n');
}

/**
 * Get the recommended temperature for the agent model.
 * Returns null if no override (use default).
 */
export function getRecommendedTemperature(modelId: string): number | null {
    return getModelAdapter(modelId).recommendedTemperature;
}
