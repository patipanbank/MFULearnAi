
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Try to load env from persistent location
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfu_learn_ai';

const LogSchema = new mongoose.Schema({
    timestamp: Date,
    level: String,
    service: String,
    userId: String,
    action: String,
    details: mongoose.Schema.Types.Mixed,
    environment: String,
    retentionDays: Number,
    expiresAt: Date
});

const LogEntry = mongoose.model('LogEntry', LogSchema);

async function debug() {
    try {
        console.log(`Connecting to ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const count = await LogEntry.countDocuments({ action: 'agent_reliability_telemetry' });
        console.log(`Found ${count} agent_reliability_telemetry logs.`);

        if (count > 0) {
            const sample = await LogEntry.findOne({ action: 'agent_reliability_telemetry' }).sort({ timestamp: -1 });
            console.log('Sample Log Entry details:', JSON.stringify(sample?.details, null, 2));

            // Test Aggregation
            const userId = sample?.userId;
            console.log(`Running aggregation for user: ${userId}`);

            const agg = await LogEntry.aggregate([
                {
                    $match: {
                        action: { $in: ['chat_completion', 'agent_reliability_telemetry'] },
                        userId: userId
                    }
                },
                {
                    $group: {
                        _id: null,
                        tokens: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$action", "chat_completion"] },
                                    { $ifNull: ["$details.tokens.total", 0] },
                                    { $ifNull: ["$details.totalTokens", 0] }
                                ]
                            }
                        },
                        requests: { $sum: 1 }
                    }
                }
            ]);
            console.log('Aggregation Result:', JSON.stringify(agg, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
