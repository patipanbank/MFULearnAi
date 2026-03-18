/**
 * ToolSelectionHintService — Lightweight Pre-LLM Tool Routing
 * 
 * Analyzes user queries BEFORE sending to the LLM and generates hints
 * about which tools are most relevant. This compensates for Nova's
 * weaker tool selection by providing explicit guidance in the prompt.
 * 
 * Design:
 *   - Zero LLM calls — pure keyword/pattern matching (< 1ms)
 *   - Returns hints that are injected into the user message
 *   - Gracefully degrades: if uncertain, returns no hint (LLM decides)
 *   - Hints are "suggestions" not "commands" — the LLM can override
 * 
 * When Claude is available: hints become less critical but still useful
 * for reducing unnecessary tool calls (cost savings).
 */

export interface ToolHint {
    /** Suggested tool name */
    tool: string;
    /** Confidence: 'high' = very likely correct, 'medium' = good guess */
    confidence: 'high' | 'medium';
    /** Optimized query to pass to the tool (Thai, cleaned, no fluff) */
    suggestedQuery?: string;
    /** Why this tool was suggested (for logging) */
    reason: string;
}

// ── Pattern Definitions ─────────────────────────────────────────────────────

interface PatternRule {
    /** Regex patterns to match (any match triggers) */
    patterns: RegExp[];
    /** Negative patterns — if matched, skip this rule */
    excludePatterns?: RegExp[];
    /** Tool to suggest */
    tool: string;
    /** Confidence level */
    confidence: 'high' | 'medium';
    /** Human-readable reason */
    reason: string;
}

/**
 * Priority-ordered rules. First match wins.
 * Rules are ordered from most specific to most general.
 */
const RULES: PatternRule[] = [
    // ── Calculator (highest priority — clearest signal) ──────────────────
    {
        patterns: [
            /คำนวณ|คิดเงิน|รวม|ผลรวม|หาร|คูณ|บวก|ลบ|เปอร์เซ็นต์|ดอกเบี้ย|กี่บาท/i,
            /\d+\s*[\+\-\*\/\%]\s*\d+/,  // Arithmetic expressions: 100 + 200
            /calculate|sum|average|total|percent/i,
        ],
        tool: 'calculator',
        confidence: 'high',
        reason: 'math/calculation keywords detected',
    },

    // ── Policy Checker (policy/rules/regulations) ────────────────────────
    {
        patterns: [
            /นโยบาย|ระเบียบ|ข้อบังคับ|กฎ|ข้อกำหนด|ประกาศ|คำสั่ง|หลักเกณฑ์/i,
            /PDPA|พ\.?ร\.?บ\.?|กฎหมาย|สิทธิ์|ความเป็นส่วนตัว|ข้อมูลส่วนบุคคล/i,
            /บทลงโทษ|โทษ|ลงโทษ|พักงาน|พักการเรียน|ไล่ออก|ตัดคะแนน|ภาคทัณฑ์/i,
            /ทุจริต|ลอกข้อสอบ|โกง|ขโมย|ผิดวินัย|ฝ่าฝืน|ละเมิด/i,
            /ลาป่วย|ลากิจ|ลาพักร้อน|วันลา|สิทธิ์ลา|การลา/i,
            /อนุมัติ|อนุญาต|ห้าม|ต้อง|ควร.*ทำ|ไม่ควร|ข้อห้าม/i,
            /สอบ.*ระเบียบ|ระเบียบ.*สอบ|เข้าสอบ|ขาดสอบ/i,
            /policy|regulation|rule|compliance|disciplin/i,
        ],
        excludePatterns: [
            /คำนวณ|เท่าไหร่.*บาท|รวมเงิน/i,  // Money calculation ≠ policy
        ],
        tool: 'check_policy',
        confidence: 'high',
        reason: 'policy/regulation/rule keywords detected',
    },

    // ── Table Lookup (structured data) ───────────────────────────────────
    {
        patterns: [
            /รายชื่อ|ตาราง|list|สารบัญ|ลำดับ|อันดับ|ranking/i,
            /เบอร์โทร|เบอร์ติดต่อ|อีเมล|ที่อยู่.*ติดต่อ/i,
            /ตารางเรียน|ตารางสอน|schedule|timetable/i,
            /รหัสวิชา|รหัสนักศึกษา|course.*code/i,
        ],
        tool: 'lookup_knowledge_table',
        confidence: 'medium',
        reason: 'structured data / table keywords detected',
    },

    // ── Search (general knowledge — broadest match, lowest priority) ─────
    {
        patterns: [
            /ใคร|ที่ไหน|เมื่อไหร่|อะไร|อย่างไร|ทำไม|กี่|เท่าไหร่/i,
            /ข้อมูล|รายละเอียด|ข่าว|ความหมาย|คือ|หมายถึง/i,
            /มหาวิทยาลัย|MFU|แม่ฟ้าหลวง|คณะ|สาขา|หลักสูตร/i,
            /สมัคร|ลงทะเบียน|เปิดรับ|ปฏิทิน|กำหนดการ/i,
            /อาจารย์|บุคลากร|เจ้าหน้าที่|ผู้อำนวยการ/i,
            /อาคาร|สถานที่|ห้อง|แผนที่|ที่ตั้ง/i,
        ],
        excludePatterns: [
            /นโยบาย|ระเบียบ|ข้อบังคับ|กฎ|PDPA|บทลงโทษ|ลาป่วย/i,
        ],
        tool: 'search',
        confidence: 'medium',
        reason: 'general information/fact-seeking query',
    },
];

// ── Greeting/Chat Detection (no tool needed) ────────────────────────────

const GREETING_PATTERNS = [
    /^(สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|hello|hi|hey|yo|เฮ้|ว่าไง)/i,
    /^(ขอบคุณ|ขอบใจ|thanks|thank you|thx)/i,
    /^(ลาก่อน|บาย|bye|goodbye|ไปก่อน)/i,
    /^(ทดสอบ|test|ping)/i,
    /^(เป็นใคร|คุณชื่ออะไร|แนะนำตัว)/i,
    /^(ช่วยอะไรได้|ทำอะไรได้)/i,
];

function isGreeting(query: string): boolean {
    const trimmed = query.trim();
    if (trimmed.length < 30) {  // Short messages are more likely greetings
        return GREETING_PATTERNS.some(p => p.test(trimmed));
    }
    return false;
}

// ── Query Cleaning ──────────────────────────────────────────────────────

/**
 * Clean query for tool input: remove filler words, keep the core question.
 */
function cleanQueryForTool(query: string): string {
    return query
        .replace(/^(ช่วย|กรุณา|ขอ|อยากรู้|อยากทราบ|บอก|หา|ค้นหา)\s*/gi, '')
        .replace(/(หน่อย|ครับ|ค่ะ|คะ|นะ|จ้า|จ๊ะ|ด้วย|ให้ผม|ให้หนู|ได้ไหม|ได้มั้ย)\s*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Public API ──────────────────────────────────────────────────────────

export class ToolSelectionHintService {

    /**
     * Analyze a user query and return tool hints.
     * Returns null if no confident suggestion (let LLM decide).
     */
    static analyze(query: string, availableTools: string[]): ToolHint | null {
        if (!query || query.trim().length === 0) return null;

        // Skip greetings / chat
        if (isGreeting(query)) return null;

        const trimmedQuery = query.trim();

        for (const rule of RULES) {
            // Check if the suggested tool is actually available
            if (!availableTools.includes(rule.tool)) continue;

            // Check exclude patterns first
            if (rule.excludePatterns?.some(p => p.test(trimmedQuery))) continue;

            // Check positive patterns
            const matched = rule.patterns.some(p => p.test(trimmedQuery));
            if (!matched) continue;

            return {
                tool: rule.tool,
                confidence: rule.confidence,
                suggestedQuery: cleanQueryForTool(trimmedQuery),
                reason: rule.reason,
            };
        }

        return null;
    }

    /**
     * Format a hint as an injection for the user message.
     * This is appended to the user's message so the LLM sees it naturally.
     * 
     * Format: subtle hint, not a command — the LLM can override.
     */
    static formatHintForPrompt(hint: ToolHint): string {
        if (hint.confidence === 'high') {
            return `\n[System hint: use tool "${hint.tool}" for this question]`;
        }
        return `\n[System hint: try "${hint.tool}" to search for information]`;
    }
}
