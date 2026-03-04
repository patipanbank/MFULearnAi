/**
 * Unit Tests — QueueService (DLQ)
 *
 * Tests Dead Letter Queue functionality.
 * Uses mocks for BullMQ to avoid requiring a real Redis connection.
 */

// Mock BullMQ before importing
jest.mock('bullmq', () => {
    const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: 'mock-job-1' }),
        getJob: jest.fn(),
        getJobs: jest.fn().mockResolvedValue([]),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, delayed: 0 }),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
    };

    return {
        Queue: jest.fn(() => ({ ...mockQueue })),
        QueueEvents: jest.fn(() => ({
            on: jest.fn(),
            off: jest.fn(),
        })),
    };
});

// Mock LoggerService
jest.mock('../../services/LoggerService', () => ({
    LoggerService: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        audit: jest.fn(),
    }
}));

describe('QueueService DLQ', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should export queueService singleton', () => {
        const { queueService } = require('../../services/QueueService');
        expect(queueService).toBeDefined();
        expect(queueService.ocrQueue).toBeDefined();
        expect(queueService.dlqQueue).toBeDefined();
    });

    it('should have moveToDlq method', () => {
        const { queueService } = require('../../services/QueueService');
        expect(typeof queueService.moveToDlq).toBe('function');
    });

    it('should have replayDlqJob method', () => {
        const { queueService } = require('../../services/QueueService');
        expect(typeof queueService.replayDlqJob).toBe('function');
    });

    it('should have getDlqStats method', () => {
        const { queueService } = require('../../services/QueueService');
        expect(typeof queueService.getDlqStats).toBe('function');
    });

    it('should have replayAllDlq method', () => {
        const { queueService } = require('../../services/QueueService');
        expect(typeof queueService.replayAllDlq).toBe('function');
    });

    it('should have close method for graceful shutdown', () => {
        const { queueService } = require('../../services/QueueService');
        expect(typeof queueService.close).toBe('function');
    });
});
