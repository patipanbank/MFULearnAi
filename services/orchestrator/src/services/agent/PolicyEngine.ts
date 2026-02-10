import { Intent, ExecutionPlan, WorkflowStep } from './types';

export class PolicyEngine {
    private static REGISTRY: Map<Intent, ExecutionPlan> = new Map();

    // R2.1: Explicit Policy Definition (No LLM generation)
    // R7.2: Versioned Policies
    static {
        // --- Policy: FACT_LOOKUP ---
        this.register({
            policyId: 'fact_lookup_v1',
            version: '1.0.0',
            intent: Intent.FACT_LOOKUP,
            steps: [
                {
                    id: 'search_knowledge',
                    tool: 'search',
                    description: 'Search internal knowledge base',
                    condition: 'always',
                    requiredParams: ['query'],
                    stepTimeoutMs: 5000
                }
            ]
        });

        // --- Policy: CALCULATION ---
        this.register({
            policyId: 'calculation_v1',
            version: '1.0.0',
            intent: Intent.CALCULATION,
            steps: [
                {
                    id: 'perform_calc',
                    tool: 'calculator',
                    description: 'Perform mathematical calculation',
                    condition: 'always',
                    requiredParams: ['expression'],
                    stepTimeoutMs: 3000
                }
            ]
        });

        // --- Policy: RESEARCH (Complex) ---
        this.register({
            policyId: 'research_v1',
            version: '1.0.0',
            intent: Intent.RESEARCH,
            steps: [
                {
                    id: 'search_primary',
                    tool: 'search',
                    description: 'Broad search for topic',
                    condition: 'always',
                    requiredParams: ['query'],
                    stepTimeoutMs: 8000
                },
                // In a future version, we could add a second step here like 'summarize'
            ]
        });

        // --- Policy: CHITCHAT ---
        this.register({
            policyId: 'chitchat_v1',
            version: '1.0.0',
            intent: Intent.CHITCHAT,
            steps: [] // No tools, direct synthesis
        });

        // --- Policy: GENERAL_QUERY (Fallback) ---
        this.register({
            policyId: 'general_query_v1',
            version: '1.0.0',
            intent: Intent.GENERAL_QUERY,
            steps: [
                {
                    id: 'search_fallback',
                    tool: 'search',
                    description: 'Fallback search',
                    condition: 'always',
                    requiredParams: ['query'],
                    stepTimeoutMs: 5000
                }
            ]
        });

        // --- Policy: GRADE_CHECK (Demo for R2.1) ---
        // If we had a grade tool, it would look like this:
        /*
        this.register({
           policyId: 'grade_check_v1',
           version: '1.0.0',
           intent: Intent.GRADE_CHECK,
           steps: [
               { id: 'verify_user', tool: 'user_profile', ... },
               { id: 'fetch_grade', tool: 'grade_service', condition: 'if_previous_success' ... }
           ]
        });
        */
    }

    private static register(plan: ExecutionPlan) {
        this.REGISTRY.set(plan.intent, plan);
    }

    public static getPlan(intent: Intent): ExecutionPlan {
        const plan = this.REGISTRY.get(intent);
        if (!plan) {
            // Default Fallback
            return this.REGISTRY.get(Intent.GENERAL_QUERY)!;
        }
        return plan;
    }
}
