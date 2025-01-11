import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import authRoutes from './routes/auth';

const app = express();

// เพิ่ม middleware ตามลำดับ
app.use(cors({
  origin: ['http://localhost:5173', 'https://authsso.mfu.ac.th'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// เพิ่ม session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// เพิ่ม passport middleware
app.use(passport.initialize());
app.use(passport.session());

// เพิ่ม passport serialize/deserialize
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// mount routes
app.use('/api/auth', authRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
}); 