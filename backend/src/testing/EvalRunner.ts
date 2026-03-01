import fs from 'fs';
import path from 'path';
import { KnowledgeService } from '../services/KnowledgeService';
import { SummarizationService } from '../services/SummarizationService';
import { LoggerService } from '../services/LoggerService';

export class EvalRunner {
    static async runRAG(datasetPath: string) {
        const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
        let totalRecall = 0;
        let totalPrecision = 0;

        console.log(`\n--- RAG Static Evaluation (${dataset.length} cases) ---`);

        for (const test of dataset) {
            const { text } = await KnowledgeService.search(test.query, { userId: 'eval_user', role: 'admin' }, { intent: test.intent });

            // Basic metric check: Are expected Doc IDs or keywords present in the flat text result?
            const foundCount = test.must_include.filter((keyword: string) => text.toLowerCase().includes(keyword.toLowerCase())).length;
            const recall = foundCount / test.must_include.length;

            totalRecall += recall;
            console.log(`[${test.id}] Recall: ${(recall * 100).toFixed(1)}% | Intent: ${test.intent}`);
        }

        console.log(`Average RAG Recall: ${((totalRecall / dataset.length) * 100).toFixed(1)}%`);
    }

    static async runContext(datasetPath: string) {
        const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
        console.log(`\n--- Context Summarization Evaluation (${dataset.length} cases) ---`);

        for (const test of dataset) {
            // Mock initial context
            const mockCurrent: any = {
                canonical: '',
                rolling: { facts: [], tentative_facts: [], intent: { primary: 'QUERY', confidence: 1.0 }, constraints: [], decisions: [], open_questions: [], confidence_score: 1.0 },
                version: 0,
                hashes: { canonical: '', rolling: '', raw: '' },
                lastCanonizedAt: new Date()
            };

            const newRolling = await SummarizationService.generateRollingSummary(mockCurrent.rolling, test.input_messages);

            // Check for expected facts/decisions
            const factsFound = test.expected.facts?.filter((ef: string) => JSON.stringify(newRolling.facts).toLowerCase().includes(ef.toLowerCase())).length || 0;
            const factRecall = test.expected.facts ? factsFound / test.expected.facts.length : 1;

            console.log(`[${test.id}] Fact Recall: ${(factRecall * 100).toFixed(1)}% | Confidence: ${newRolling.confidence_score.toFixed(2)}`);
        }
    }
}
