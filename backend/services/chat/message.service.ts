import { ChatMessage } from '../../types/chat';
import { CHAT_LIMITS } from '../../constants';

/**
 * Service for message processing and summarization
 */
export class MessageService {
  /**
   * Detect question type from query
   */
  detectQuestionType(query: string): string {
    const questionTypes = {
      FACTUAL: 'factual',
      ANALYTICAL: 'analytical',
      CONCEPTUAL: 'conceptual',
      PROCEDURAL: 'procedural',
      CLARIFICATION: 'clarification',
    };

    const patterns = {
      [questionTypes.FACTUAL]: /^(what|when|where|who|which|how many|how much)/i,
      [questionTypes.ANALYTICAL]: /^(why|how|what if|what are the implications|analyze|compare|contrast)/i,
      [questionTypes.CONCEPTUAL]: /^(explain|describe|define|what is|what are|how does)/i,
      [questionTypes.PROCEDURAL]: /^(how to|how do|what steps|how can|show me how)/i,
      [questionTypes.CLARIFICATION]: /^(can you clarify|what do you mean|please explain|could you elaborate)/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) {
        return type;
      }
    }

    return questionTypes.FACTUAL; // Default
  }

  /**
   * Get prompt template for question type
   */
  getPromptTemplate(questionType: string): string {
    const promptTemplates: Record<string, string> = {
      factual: 'Provide a direct and accurate answer based on the following context:',
      analytical: 'Analyze the following information and provide insights:',
      conceptual: 'Explain the concept using the following context:',
      procedural: 'Describe the process or steps based on:',
      clarification: 'To better answer your question, let me clarify based on:',
    };

    return promptTemplates[questionType] || promptTemplates.factual;
  }

  /**
   * Summarize old messages for context
   */
  summarizeOldMessages(messages: ChatMessage[]): string {
    if (messages.length <= 0) {
      return '';
    }

    const summary = messages
      .map((msg) => {
        const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        const content =
          msg.content.length > 100 ? `${msg.content.substring(0, 97)}...` : msg.content;
        return `${role}: ${content}`;
      })
      .join('\n');

    return `Previous conversation summary:\n${summary}`;
  }

  /**
   * Split messages into recent and older based on length
   */
  splitMessages(messages: ChatMessage[]): {
    recent: ChatMessage[];
    older: ChatMessage[];
  } {
    // Calculate average message length
    const avgMessageLength =
      messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) /
      Math.max(1, messages.length);

    // Set message limit based on average length
    const MESSAGE_LIMIT =
      avgMessageLength > CHAT_LIMITS.MAX_CHAR_THRESHOLD
        ? CHAT_LIMITS.LONG_MESSAGE_LIMIT
        : CHAT_LIMITS.DEFAULT_MESSAGE_LIMIT;

    if (messages.length > MESSAGE_LIMIT) {
      return {
        older: messages.slice(0, messages.length - MESSAGE_LIMIT),
        recent: messages.slice(messages.length - MESSAGE_LIMIT),
      };
    }

    return {
      older: [],
      recent: [...messages],
    };
  }

  /**
   * Format file attachments for prompt
   */
  formatFileAttachments(files?: Array<{ name: string; mediaType: string; size: number; content?: string }>): string {
    if (!files || files.length === 0) {
      return '';
    }

    const fileInfo = files
      .map((file) => {
        let fileDetail = `- ${file.name} (${file.mediaType}, ${Math.round(file.size / 1024)} KB)`;
        if (file.content) {
          fileDetail += ' - File content included';
        }
        return fileDetail;
      })
      .join('\n');

    return `\n\n[Attached files]\n${fileInfo}`;
  }
}

export const messageService = new MessageService();
