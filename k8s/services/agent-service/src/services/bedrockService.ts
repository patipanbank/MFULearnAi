/**
 * Bedrock Service stub - ChatBedrockConverse used directly in LangGraph
 */

export const bedrockService = {
  invoke: async (params: any) => {
    console.warn('bedrockService stub - use ChatBedrockConverse instead');
    return {};
  },
  createTextEmbedding: async (text: string) => {
    console.warn('bedrockService.createTextEmbedding stub');
    return { embedding: [] };
  }
};
