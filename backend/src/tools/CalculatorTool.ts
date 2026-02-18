import { AgentTool, AgentContext, ToolResult } from './AgentTool';

export class CalculatorTool extends AgentTool {
    name = 'calculator';
    description = 'Perform basic arithmetic operations (add, subtract, multiply, divide).';
    allowedRoles = ['*'];

    // Native JSON Schema for Bedrock/Claude 3.5
    schemaJSON = {
        name: 'calculator',
        description: 'Perform basic arithmetic operations.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        enum: ['add', 'subtract', 'multiply', 'divide'],
                        description: 'The operation to perform.'
                    },
                    a: {
                        type: 'number',
                        description: 'First number.'
                    },
                    b: {
                        type: 'number',
                        description: 'Second number.'
                    }
                },
                required: ['operation', 'a', 'b']
            }
        }
    };

    async execute(args: any, context: AgentContext): Promise<ToolResult> {
        try {
            const { operation, a, b } = args;
            let result: number = 0;

            switch (operation) {
                case 'add': result = a + b; break;
                case 'subtract': result = a - b; break;
                case 'multiply': result = a * b; break;
                case 'divide':
                    if (b === 0) throw new Error('Division by zero');
                    result = a / b;
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            return { success: true, result };
        } catch (error: any) {
            return { success: false, result: null, error: error.message };
        }
    }
}
