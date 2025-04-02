export const chatConfig = {
  // RAG and ChromaDB settings
  BATCH_SIZE: 3, // Number of collections to query simultaneously
  MIN_SIMILARITY_THRESHOLD: 0.1, // Minimum similarity for context relevance

  // AI Interaction settings
  RETRY_CONFIG: {
    maxRetries: 3,
    baseDelay: 1000, // milliseconds
    maxDelay: 5000, // milliseconds
  },

  // Default System Prompt (can be overridden by database)
  DEFAULT_SYSTEM_PROMPT: `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

Response Style 🎯:
- Be concise, friendly and conversational
- Always respond in the same language the user is using
- Use appropriate emojis to make responses engaging
- Never say "I don't know" or "I'm not sure"
- Always provide answers using your knowledge and reasoning
- Break down complex topics into clear steps
- Use markdown formatting effectively

Knowledge Approach 📚:
- Use provided context first, then general knowledge
- Can analyze images, read files, search web
- Provide step-by-step solutions for issues
- Cite sources when referencing specific information
- For MFU questions without specific data, provide helpful general information

Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.`,

  // Question type definitions (used for prompt templating/logic)
  QUESTION_TYPES: {
    FACTUAL: 'factual',
    ANALYTICAL: 'analytical',
    CONCEPTUAL: 'conceptual',
    PROCEDURAL: 'procedural',
    CLARIFICATION: 'clarification',
  },

  // Basic prompt templates based on question type
  PROMPT_TEMPLATES: {
    factual: 'Provide a direct and accurate answer based on the following context:',
    analytical: 'Analyze the following information and provide insights:',
    conceptual: 'Explain the concept using the following context:',
    procedural: 'Describe the process or steps based on:',
    clarification: 'To better answer your question, let me clarify based on:',
  },

  // Message summarization settings
  MESSAGE_SUMMARY_THRESHOLD: 10, // Number of messages before summarization kicks in
  MESSAGE_SUMMARY_KEEP_COUNT: 4, // Number of recent messages to keep in full detail after summarization

  // Filename for RAG sources
  WEB_SEARCH_SOURCE_FILENAME: 'Web Search Results',
};

// Helper function to get prompt template, defaulting to factual
export const getPromptTemplate = (type: string): string => {
  return chatConfig.PROMPT_TEMPLATES[type as keyof typeof chatConfig.PROMPT_TEMPLATES] || chatConfig.PROMPT_TEMPLATES.factual;
}; 