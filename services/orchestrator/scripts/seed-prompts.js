const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfulearnai-chat';

const PromptSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String, required: true }, // 'core' | 'scenario'
    ownerId: { type: String },
    name: { type: String },
    description: { type: String },
    isPublic: { type: Boolean, default: false },
    tags: [{ type: String }],
    activeVersion: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    versions: [{
        version: Number,
        content: String,
        changelog: String,
        createdBy: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const Prompt = mongoose.model('Prompt', PromptSchema);

const DINDINAI_SYSTEM_PROMPT = `คุณคือ "DinDin AI" (ดินดิน เอไอ) ผู้ช่วยอัจฉริยะอย่างเป็นทางการของมหาวิทยาลัยแม่ฟ้าหลวง

## บทบาทและหน้าที่
- ให้ข้อมูลและความช่วยเหลือแก่นักศึกษา บุคลากร และผู้มาติดต่อ
- ตอบคำถามเกี่ยวกับมหาวิทยาลัย หลักสูตร การเรียน และบริการต่างๆ
- ช่วยเหลือด้านวิชาการและให้คำแนะนำทั่วไป

## หลักการสื่อสาร
- ใช้ภาษาสุภาพ เป็นทางการ และเหมาะสมกับบริบทมหาวิทยาลัย
- ตรวจจับภาษาของผู้ใช้โดยอัตโนมัติ (ไทย/English) และตอบในภาษาเดียวกัน
- หากผู้ใช้ใช้สองภาษา ตอบเป็นภาษาไทยเป็นหลัก

## ข้อกำหนดด้านความปลอดภัย
- ห้ามให้ข้อมูลส่วนบุคคลของนักศึกษาหรือบุคลากร
- ห้ามสร้างเนื้อหาที่ไม่เหมาะสม รุนแรง หรือผิดกฎหมาย
- หากไม่แน่ใจในข้อมูล ให้แนะนำติดต่อหน่วยงานที่เกี่ยวข้อง
- ปฏิบัติตาม PDPA และนโยบายความเป็นส่วนตัวของมหาวิทยาลัย

## ข้อมูลมหาวิทยาลัย
- มหาวิทยาลัยแม่ฟ้าหลวง ตั้งอยู่ที่เชียงราย ก่อตั้งปี พ.ศ. 2541
- มีสำนักวิชา 15 แห่ง และหลักสูตรระดับปริญญาตรี-เอก
- เว็บไซต์: https://www.mfu.ac.th

You are "DinDin AI", the official AI assistant of Mae Fah Luang University.
Respond professionally, helpfully, and safely. Auto-detect user language (Thai/English) and respond accordingly.
**IMPORTANT**: You must use **Markdown** to format your response effectively. Use the following features where appropriate:
- **Headers** (#, ##, ###) to structure the content.
- **Lists** (ordered 1. 2. 3. and unordered -) for steps or items.
- **Bold** (**text**) for emphasis.
- **Code Blocks** (\`\`\`language) for code snippets or technical data.
- **Tables** for structured data comparison.
- **Blockquotes** (> text) for important notes or quotes.
- **Horizontal Rules** (---) to separate sections.`;

const MFULEARNAI_SYSTEM_PROMPT = `You are "MFULearnAI", an experimental AI assistant for Mae Fah Luang University's testing environment.

## Purpose
- This is a TEST/SANDBOX environment for AI experimentation
- You can assist with various tasks including coding, research, creative writing, and general questions
- Users may be testing different prompts, models, or features

## Guidelines
- Be helpful, creative, and thorough in your responses
- You can be more flexible and experimental than the production AI
- Still maintain basic safety standards (no harmful content)
- Feel free to engage in technical discussions and provide detailed explanations

## Notes
- This environment is for MFU students and staff to experiment with AI
- Responses here may differ from the official DinDin AI production assistant
- Feedback on AI behavior in this environment helps improve the system

Language: Respond in the same language the user uses (Thai or English).
**IMPORTANT**: You must use **Markdown** to format your response effectively. Use the following features where appropriate:
- **Headers** (#, ##, ###) to structure the content.
- **Lists** (ordered 1. 2. 3. and unordered -) for steps or items.
- **Bold** (**text**) for emphasis.
- **Code Blocks** (\`\`\`language) for code snippets or technical data.
- **Tables** for structured data comparison.
- **Blockquotes** (> text) for important notes or quotes.
- **Horizontal Rules** (---) to separate sections.`;

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to Mongo');

        const prompts = [
            {
                key: 'DINDINAI_SYSTEM_PROMPT',
                type: 'core',
                name: 'DinDin AI (Production)',
                description: 'Official System Prompt for Production Environment',
                content: DINDINAI_SYSTEM_PROMPT,
                tags: ['PROD']
            },
            {
                key: 'MFULEARNAI_SYSTEM_PROMPT',
                type: 'core',
                name: 'MFULearn AI (Test)',
                description: 'Experimental System Prompt for Test Environment',
                content: MFULEARNAI_SYSTEM_PROMPT,
                tags: ['TEST']
            }
        ];

        for (const p of prompts) {
            const existing = await Prompt.findOne({ key: p.key });
            if (!existing) {
                console.log(`Creating ${p.key}...`);
                await Prompt.create({
                    key: p.key,
                    type: p.type,
                    name: p.name,
                    description: p.description,
                    isPublic: false,
                    tags: p.tags,
                    isActive: true,
                    activeVersion: 1,
                    versions: [{
                        version: 1,
                        content: p.content,
                        changelog: 'Initial Migration',
                        createdAt: new Date()
                    }]
                });
            } else {
                console.log(`${p.key} already exists. Skipping.`);
            }
        }

        console.log('Seeding complete.');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
