import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import passport from 'passport';
import authRoutes from './routes/auth';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);  // เปลี่ยนจาก /api/auth เป็น /auth

// Test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; 