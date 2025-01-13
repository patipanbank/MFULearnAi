import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import authRoutes from './routes/auth';
import bodyParser from 'body-parser';

const app = express();

// เพิ่ม body parser ก่อน routes
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// เพิ่ม raw body parser สำหรับ SAML
app.use((req, res, next) => {
  if (req.url === '/api/auth/saml/callback') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
});

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

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