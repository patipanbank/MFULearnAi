
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

        // 3. Find ONE Agent Log from today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        console.log('--- Analyzing Today Log ---');
        console.log('Start of Day:', startOfDay.toISOString());

        const agentLogToday = await LogEntry.findOne({
            action: 'agent_reliability_telemetry',
            timestamp: { $gte: startOfDay }
        });

        if (agentLogToday) {
            console.log('Found Agent Log Today!');
            console.log('ID:', agentLogToday._id);
            console.log('User ID:', agentLogToday.userId);
            console.log('Environment:', agentLogToday.environment);
            console.log('Timestamp:', agentLogToday.timestamp.toISOString());
            console.log('Details.totalTokens:', agentLogToday.details?.totalTokens);

            // Run EXACT Server Aggregation for this User
            const agg = await LogEntry.aggregate([
                {
                    $match: {
                        action: { $in: ['chat_completion', 'agent_reliability_telemetry'] },
                        environment: agentLogToday.environment, // Use actual env
                        userId: agentLogToday.userId,         // Use actual user
                        timestamp: { $gte: startOfDay }
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
            console.log('Server Aggregation Result (Today):', JSON.stringify(agg, null, 2));

        } else {
            console.log('❌ NO Agent Telemetry logs found for Today.');
            const anyLog = await LogEntry.findOne({ timestamp: { $gte: startOfDay } });
            if (anyLog) {
                console.log('But found OTHER logs today:', anyLog.action, 'Env:', anyLog.environment);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
