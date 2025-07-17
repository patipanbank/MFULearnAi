import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import authRouter from './routes/auth';
import { connectDB } from './lib/mongodb';

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRouter);

app.get('/', (req, res) => {
  res.send('MFULearnAi Node.js Backend');
});

// Error handler middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 