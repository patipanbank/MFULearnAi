/**
 * Memory Service stub - LangGraph now handles memory with StateGraph checkpointer
 */

export const memoryService = {
  getConversationContext: async (sessionId: string, query: string) => ({}),
  searchMemory: async (sessionId: string, query: string, limit: number) => ([]),
  addMessage: async (sessionId: string, message: any) => {},
  embedMessage: async (sessionId: string, content: string) => {}
};
