import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../models/User';

const router = Router();

router.post('/create', roleGuard(['Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const { username, password, firstName, lastName, email } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!username || !password || !firstName || !lastName || !email) {
      res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      return;
    }

    // ตรวจสอบว่ามี username ซ้ำหรือไม่
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.status(400).json({ message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
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
      message: 'สร้างผู้ดูแลระบบสำเร็จ',
      admin: adminData
    });

  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างผู้ดูแลระบบ' });
  }
});

export default router; 