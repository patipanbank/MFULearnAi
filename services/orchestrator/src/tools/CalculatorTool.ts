import { AgentTool, AgentContext, ToolResult } from './AgentTool';

export class CalculatorTool extends AgentTool {
    name = 'calculator';
    description = 'Perform basic arithmetic operations (add, subtract, multiply, divide).';
    allowedRoles = ['*'];

    schema = `
<tool_definition>
    <name>calculator</name>
    <description>Perform basic arithmetic operations.</description>
    <parameters>
        <parameter>
            <name>operation</name>
            <type>string</type>
            <enum>add, subtract, multiply, divide</enum>
            <description>The operation to perform.</description>
        </parameter>
        <parameter>
            <name>a</name>
            <type>number</type>
            <description>First number.</description>
        </parameter>
        <parameter>
            <name>b</name>
            <type>number</type>
            <description>Second number.</description>
        </parameter>
    </parameters>
</tool_definition>
`;

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
