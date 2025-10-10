/**
 * Redis stub - LangGraph now handles persistence with MemorySaver
 */

export const redis = {
  get: async (key: string) => null,
  set: async (key: string, value: any, ...args: any[]) => {},
  del: async (key: string) => {}
};
