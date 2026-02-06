
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Try to load env
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfulearnai-logs';

const LogSchema = new mongoose.Schema({
    timestamp: Date,
    level: String,
    service: String,
    userId: String,
    action: String,
    details: mongoose.Schema.Types.Mixed,
    environment: String
});

const LogEntry = mongoose.model('LogEntry', LogSchema);

async function debug() {
    try {
        console.log(`Connecting to ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // 1. Check Most Recent Log
        const latest = await LogEntry.findOne().sort({ timestamp: -1 });
        if (latest) {
            console.log('Latest Log Timestamp:', latest.timestamp);
            console.log('Latest Log Action:', latest.action);
            console.log('Latest Log Details:', JSON.stringify(latest.details, null, 2));
        } else {
            console.log('No logs found in DB.');
        }

        // 2. Count Agent Logs
        const count = await LogEntry.countDocuments({ action: 'agent_reliability_telemetry' });
        console.log(`Total Agent Logs: ${count}`);

        // 3. Count Today's Logs
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        console.log('Checking logs since:', startOfDay.toISOString());

        const todayCount = await LogEntry.countDocuments({ timestamp: { $gte: startOfDay } });
        console.log(`Logs since start of day: ${todayCount}`);

        if (count > 0) {
            // ... (keep existing aggregation test if needed, but the above is more critical)
            const agg = await LogEntry.aggregate([
                {
                    $match: {
                        action: { $in: ['chat_completion', 'agent_reliability_telemetry'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalTokens: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$action", "chat_completion"] },
                                    { $ifNull: ["$details.tokens.total", 0] },
                                    { $ifNull: ["$details.totalTokens", 0] }
                                ]
                            }
                        }
                    }
                }
            ]);
            console.log('Global Token Count (Agg):', agg[0]?.totalTokens);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
