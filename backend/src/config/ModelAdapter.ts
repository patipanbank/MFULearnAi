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
คุณต้องคิด วางแผน และให้เหตุผลเป็นภาษาไทยเสมอ
- Internal planning: ภาษาไทย
- Tool argument (query/context): ภาษาไทย ยกเว้นชื่อเฉพาะ (PDPA, MFU, IT ฯลฯ)
- Final answer: ภาษาไทย (ใช้ภาษาอังกฤษเฉพาะคำศัพท์เทคนิค)
- ห้ามแปลคำถามของผู้ใช้เป็นภาษาอังกฤษก่อนประมวลผล
- ห้ามใช้ภาษาอังกฤษในขั้นตอนการวางแผนหรือคิด`,

    toolCallingDirective: `=== TOOL SELECTION DECISION TREE ===
เมื่อได้รับคำถาม ให้ตัดสินใจตามลำดับนี้:

ขั้นที่ 1: จำแนกประเภทคำถาม
  → เกี่ยวกับกฎ ระเบียบ ข้อบังคับ นโยบาย PDPA สิทธิ์ โทษ → check_policy
  → เกี่ยวกับข้อมูล ข้อเท็จจริง ข่าว ระบบ บุคคล สถานที่ → search
  → เกี่ยวกับตัวเลข คำนวณ สถิติ → calculator
  → เกี่ยวกับรายชื่อ ตาราง ข้อมูลเชิงโครงสร้าง → lookup_knowledge_table
  → ข้อมูลไม่พอที่จะเรียก tool / คำถามกำกวม → ask_user (ถามกลับก่อน)
  → สนทนาทั่วไป ทักทาย ไม่ต้องการข้อมูล → ตอบเลย ไม่ต้องใช้ tool

ขั้นที่ 2: เขียน query ที่ดี
  → ใช้ภาษาไทย ตรงประเด็น ไม่ใส่คำฟุ่มเฟือย
  → ไม่ต้องเพิ่ม "ในมหาวิทยาลัย" หรือ "ของ MFU" ลงใน query

ขั้นที่ 3: ใช้ tool เดียวที่ตรงที่สุด
  → อย่าเรียก search + check_policy พร้อมกันสำหรับคำถามเดียวกัน
  → ถ้าไม่แน่ใจว่าเป็น policy หรือข้อมูลทั่วไป → ใช้ check_policy ก่อน

=== TOOL CALL EXAMPLES (ทำตามรูปแบบนี้เท่านั้น) ===

ตัวอย่าง 1 — ค้นหาข้อมูลทั่วไป:
  ผู้ใช้: "คณะวิทย์มีสาขาอะไรบ้าง"
  → tool: search, args: {"query": "สาขาวิชาในคณะวิทยาศาสตร์"}

ตัวอย่าง 2 — ตรวจสอบระเบียบ:
  ผู้ใช้: "ลาป่วยได้กี่วัน"
  → tool: check_policy, args: {"query": "จำนวนวันลาป่วยที่อนุญาต"}

ตัวอย่าง 3 — คำนวณ:
  ผู้ใช้: "3000 บวก 1500 เท่าไหร่"
  → tool: calculator, args: {"operation": "add", "a": 3000, "b": 1500}

ตัวอย่าง 4 — ข้อมูลไม่พอ ต้องถามกลับ:
  ผู้ใช้: "ช่วยค้นหาให้หน่อย"
  → tool: ask_user, args: {"question": "ต้องการค้นหาข้อมูลเกี่ยวกับเรื่องอะไรครับ?", "reason": "ผู้ใช้ไม่ได้ระบุหัวข้อที่ต้องการค้นหา"}

=== CRITICAL RULES ===
- ห้ามเดาค่า argument ที่ไม่ปรากฏในคำถามผู้ใช้
- ถ้าไม่แน่ใจค่าของ argument → ใช้ ask_user ถามกลับก่อน
- ห้ามเพิ่ม field ที่ไม่มีใน schema ของ tool
- query ต้องเป็นภาษาไทย สั้น ตรงประเด็น`,

    outputDirective: `=== OUTPUT FORMAT ===
- ตอบตรงคำถามก่อน แล้วค่อยให้รายละเอียด
- ใช้หัวข้อย่อย (bullet) เมื่อมีข้อมูลหลายข้อ
- อ้างอิงแหล่งที่มาจาก tool results เสมอ
- ไม่ต้องอธิบายว่า "ฉันจะค้นหาให้" — ทำเลย`,

    recommendedTemperature: 0.3,  // Lower temp = more deterministic tool selection
    supportsCaching: true,   // Nova supports system prompt caching (GA April 2025)
    maxToolDescriptionLength: 200,
    injectReasoningScaffold: true,
};

const CLAUDE_ADAPTER: ModelAdapterConfig = {
    family: 'claude',

    thinkingDirective: `=== LANGUAGE DIRECTIVE ===
ให้ตอบเป็นภาษาไทย ใช้ภาษาอังกฤษเฉพาะศัพท์เทคนิค`,

    toolCallingDirective: '', // Claude is naturally good at tool selection — minimal hints needed

    outputDirective: `=== OUTPUT ===
ตอบกระชับ ตรงประเด็น อ้างอิงแหล่งข้อมูล`,

    recommendedTemperature: null, // Use default
    supportsCaching: true,
    maxToolDescriptionLength: 500,
    injectReasoningScaffold: false, // Claude reasons well natively
};

const MISTRAL_ADAPTER: ModelAdapterConfig = {
    family: 'mistral',

    thinkingDirective: `=== LANGUAGE & REASONING DIRECTIVE ===
Think and plan in Thai. Answer in Thai.
Use English only for technical terms.`,

    toolCallingDirective: `=== TOOL USAGE ===
เลือก tool ที่เหมาะสมที่สุดเพียงตัวเดียวต่อคำถาม ใช้ภาษาไทยใน query`,

    outputDirective: `=== OUTPUT ===
ตอบเป็นภาษาไทย กระชับ ตรงประเด็น`,

    recommendedTemperature: 0.4,
    supportsCaching: false,
    maxToolDescriptionLength: 300,
    injectReasoningScaffold: false,
};

const DEFAULT_ADAPTER: ModelAdapterConfig = {
    family: 'unknown',
    thinkingDirective: 'Think and respond in Thai.',
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
ก่อนทำอะไร ให้วางแผนสั้นๆ ก่อนเสมอ:
1. ทำความเข้าใจคำถาม (ผู้ใช้ต้องการอะไร?)
2. เลือก tool ที่เหมาะสม (หรือตอบเลยถ้าไม่ต้องใช้ tool)
3. เขียน query ที่ตรงประเด็น
4. วิเคราะห์ผลลัพธ์จาก tool แล้วตอบ`);
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
