"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculatorTool = void 0;
class CalculatorTool {
    getToolMeta() {
        return {
            name: 'calculator',
            description: 'Perform mathematical calculations. Supports basic arithmetic, trigonometry, and advanced math functions. Input should be a mathematical expression.',
            func: async (expression, _sessionId) => {
                try {
                    const cleanExpression = expression.replace(/[^0-9+\-*/.()^√πe\s]/g, '');
                    if (!cleanExpression.trim()) {
                        return 'Error: Invalid mathematical expression';
                    }
                    let processedExpression = cleanExpression
                        .replace(/π/g, Math.PI.toString())
                        .replace(/e(?![0-9])/g, Math.E.toString())
                        .replace(/√(\d+(?:\.\d+)?)/g, 'Math.sqrt($1)')
                        .replace(/\^/g, '**');
                    const result = new Function('Math', `
            "use strict";
            return (${processedExpression});
          `)(Math);
                    if (typeof result !== 'number' || !isFinite(result)) {
                        return 'Error: Invalid calculation result';
                    }
                    const formattedResult = Number.isInteger(result) ?
                        result.toString() :
                        result.toFixed(10).replace(/\.?0+$/, '');
                    return `${expression} = ${formattedResult}`;
                }
                catch (error) {
                    console.error('Calculator error:', error);
                    return `Error: Unable to calculate "${expression}". Please check the mathematical expression.`;
                }
            }
        };
    }
}
exports.CalculatorTool = CalculatorTool;
//# sourceMappingURL=CalculatorTool.js.map