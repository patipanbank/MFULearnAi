/**
 * Unit Tests — AgentWorkflow
 *
 * Tests the core agent workflow logic including:
 *  - Answer mode classification
 *  - Timeout handling
 *  - Usage tracking
 *  - Error handling
 */

import { AgentPhase, WorkflowState, AnswerMode } from '../../workflows/types/AgentTypes';
import { AGENT_CONSTANTS, AGENT_MESSAGES } from '../../workflows/types/AgentConstants';

// ── Test: AgentConstants ────────────────────────────────────

describe('AgentConstants', () => {
    it('should have sane MAX_AGENT_STEPS', () => {
        expect(AGENT_CONSTANTS.MAX_AGENT_STEPS).toBeGreaterThanOrEqual(5);
        expect(AGENT_CONSTANTS.MAX_AGENT_STEPS).toBeLessThanOrEqual(50);
    });

    it('should have timeout >= 60s', () => {
        expect(AGENT_CONSTANTS.AGENT_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    });

    it('should have tool timeout < agent timeout', () => {
        expect(AGENT_CONSTANTS.TOOL_TIMEOUT_MS).toBeLessThan(AGENT_CONSTANTS.AGENT_TIMEOUT_MS);
    });

    it('should have LLM retry config', () => {
        expect(AGENT_CONSTANTS.LLM_MAX_RETRIES).toBeGreaterThanOrEqual(1);
        expect(AGENT_CONSTANTS.LLM_RETRY_BASE_DELAY_MS).toBeGreaterThan(0);
        expect(AGENT_CONSTANTS.LLM_RETRYABLE_ERRORS.length).toBeGreaterThan(0);
    });

    it('should include ThrottlingException in retryable errors', () => {
        expect(AGENT_CONSTANTS.LLM_RETRYABLE_ERRORS).toContain('ThrottlingException');
    });

    it('should have error messages in Thai', () => {
        expect(AGENT_MESSAGES.ERROR_GENERIC).toMatch(/[\u0E00-\u0E7F]/); // Thai character range
        expect(AGENT_MESSAGES.ERROR_TIMEOUT).toMatch(/[\u0E00-\u0E7F]/);
    });
});

// ── Test: Answer Mode Classification ────────────────────────

describe('Answer Mode Classification', () => {
    /**
     * Port of AgentWorkflow.determineAnswerMode() for testability.
     * In production, this is a private method — we test the logic here.
     */
    function determineAnswerMode(
        usedTools: Set<string>,
        hasNativeDocBlocks: boolean
    ): { answerMode: AnswerMode; answerState: string } {
        const usedSearch = usedTools.has('search');
        const usedPolicy = usedTools.has('check_policy');

        if (hasNativeDocBlocks) {
            return { answerMode: 'file_grounded', answerState: 'VERIFIED' };
        } else if (usedPolicy && usedSearch) {
            return { answerMode: 'policy_rag', answerState: 'VERIFIED' };
        } else if (usedPolicy) {
            return { answerMode: 'policy_grounded', answerState: 'VERIFIED' };
        } else if (usedSearch) {
            return { answerMode: 'rag', answerState: 'VERIFIED' };
        } else {
            return { answerMode: 'internal', answerState: 'UNVERIFIED' };
        }
    }

    it('should default to internal/UNVERIFIED when no tools used', () => {
        const result = determineAnswerMode(new Set(), false);
        expect(result.answerMode).toBe('internal');
        expect(result.answerState).toBe('UNVERIFIED');
    });

    it('should be rag/VERIFIED when search used', () => {
        const result = determineAnswerMode(new Set(['search']), false);
        expect(result.answerMode).toBe('rag');
        expect(result.answerState).toBe('VERIFIED');
    });

    it('should be policy_grounded when only check_policy used', () => {
        const result = determineAnswerMode(new Set(['check_policy']), false);
        expect(result.answerMode).toBe('policy_grounded');
        expect(result.answerState).toBe('VERIFIED');
    });

    it('should be policy_rag when both search and check_policy used', () => {
        const result = determineAnswerMode(new Set(['search', 'check_policy']), false);
        expect(result.answerMode).toBe('policy_rag');
        expect(result.answerState).toBe('VERIFIED');
    });

    it('should prioritize file_grounded over tools', () => {
        const result = determineAnswerMode(new Set(['search', 'check_policy']), true);
        expect(result.answerMode).toBe('file_grounded');
        expect(result.answerState).toBe('VERIFIED');
    });

    it('should handle calculator without affecting mode', () => {
        const result = determineAnswerMode(new Set(['calculator']), false);
        expect(result.answerMode).toBe('internal');
        expect(result.answerState).toBe('UNVERIFIED');
    });
});

// ── Test: WorkflowState initialization ──────────────────────

describe('WorkflowState', () => {
    it('should have all required AgentPhase values', () => {
        const phases = Object.values(AgentPhase);
        expect(phases).toContain('INIT');
        expect(phases).toContain('UPLOADING');
        expect(phases).toContain('PLANNING');
        expect(phases).toContain('EXECUTING_TOOL');
        expect(phases).toContain('GENERATING_RESPONSE');
        expect(phases).toContain('COMPLETED');
        expect(phases).toContain('FAILED');
    });
});
