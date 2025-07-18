"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNotificationJob = handleNotificationJob;
async function handleNotificationJob(job) {
    const { userId, type, payload } = job.data;
    console.log(`🔔 Processing notification job for user ${userId}, type: ${type}`);
    try {
        console.log(`✅ Notification job completed for user ${userId}`);
    }
    catch (error) {
        console.error(`❌ Notification job failed for user ${userId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=notificationHandler.js.map