import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import LogEntry from './models/LogEntry';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-logs';

mongoose.connect(MONGO_URI)
    .then(() => console.log('Logger Service: Connected to MongoDB'))
    .catch(err => console.error('Logger Service: MongoDB error', err));

app.post('/api/logs', async (req, res) => {
    try {
        const { level, service, userId, action, details, environment } = req.body;

        // Simple validation
        if (!level || !service || !action) {
            return res.status(400).json({ error: 'Missing required log fields' });
        }

        const log = new LogEntry({
            level,
            service,
            userId,
            action,
            details,
            environment
        });

        await log.save();
        res.status(201).json({ success: true });
    } catch (error: any) {
        console.error('Logging error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'logger-service' }));

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    console.log(`Logger Service running on port ${PORT}`);
});
