import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../models/User';
import { SystemPrompt } from '../models/SystemPrompt';

const router = Router();

router.post('/create', roleGuard(['SuperAdmin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const { username, password, firstName, lastName, email } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!username || !password || !firstName || !lastName || !email) {
      res.status(400).json({ message: 'Please fill in all required fields' });
      return;
    }

    // ตรวจสอบว่ามี username ซ้ำหรือไม่
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.status(400).json({ message: 'This username already exists' });
      return;
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้าง Admin user ใหม่
    const newAdmin = new User({
      nameID: username,
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      role: 'Admin',
      groups: ['Admin']
    });

    await newAdmin.save();

    // ส่งข้อมูลกลับโดยไม่รวมรหัสผ่าน
    const adminData = {
      username: newAdmin.username,
      email: newAdmin.email,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      role: newAdmin.role
    };

    res.status(201).json({
      message: 'Admin created successfully',
      admin: adminData
    });

  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: 'Error creating admin' });
  }
});

// อ่าน system prompt
router.get('/system-prompt', roleGuard(['SuperAdmin']), async (req: Request, res: Response) => {
  try {
    // ดึง system prompt ล่าสุด
    let systemPrompt = await SystemPrompt.findOne().sort({ updatedAt: -1 });
    
    // ถ้าไม่มี prompt ในระบบ ให้สร้างค่าเริ่มต้น
    if (!systemPrompt) {
      const user = (req as any).user;
      systemPrompt = await SystemPrompt.create({
        prompt: 'You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.\n\nResponse Style 🎯:\n- Be concise, friendly and conversational\n- Always respond in the same language the user is using\n- Use appropriate emojis to make responses engaging\n- Never say "I don\'t know" or "I\'m not sure"\n- Always provide answers using your knowledge and reasoning\n- Break down complex topics into clear steps\n- Use markdown formatting effectively\n\nKnowledge Approach 📚:\n- Use provided context first, then general knowledge\n- Can analyze images, read files, search web\n- Provide step-by-step solutions for issues\n- Cite sources when referencing specific information\n- For MFU questions without specific data, provide helpful general information\n\nRemember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.',
        updatedBy: user.username
      });
    }
    
    res.json(systemPrompt);
  } catch (error) {
    console.error('Error getting system prompt:', error);
    res.status(500).json({ error: 'Failed to retrieve system prompt' });
  }
});

// แก้ไข system prompt
router.put('/system-prompt', roleGuard(['SuperAdmin']), async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Invalid prompt format' });
    }
    
    const user = (req as any).user;
    
    const systemPrompt = await SystemPrompt.create({
      prompt,
      updatedBy: user.username
    });
    
    res.json(systemPrompt);
  } catch (error) {
    console.error('Error updating system prompt:', error);
    res.status(500).json({ error: 'Failed to update system prompt' });
  }
});

export default router; 