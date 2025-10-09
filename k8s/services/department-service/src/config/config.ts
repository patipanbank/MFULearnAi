import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  PORT: number;
  LOG_LEVEL: string;
  MONGODB_URI: string;
  NODE_ENV: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3001'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  MONGODB_URI: process.env.MONGODB_URI || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export default config;
