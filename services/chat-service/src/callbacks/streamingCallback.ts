import { BaseCallbackHandler } from "@langchain/core/callbacks";
import { Serialized } from "@langchain/core/load/serializable";
import { WebSocket } from "ws";
import logger from "../utils/logger";

/**
 * Streaming Callback Handler for WebSocket
 * Streams LLM tokens and agent events to WebSocket clients in real-time
 */

export interface StreamingCallbackConfig {
  ws: WebSocket;
  chatId: string;
  messageId: string;
  userId: string;
}

export class StreamingCallbackHandler extends BaseCallbackHandler {
  name = "streaming_callback_handler";

  private ws: WebSocket;
  private chatId: string;
  private messageId: string;
  private userId: string;
  private fullContent: string = "";

  constructor(config: StreamingCallbackConfig) {
    super();
    this.ws = config.ws;
    this.chatId = config.chatId;
    this.messageId = config.messageId;
    this.userId = config.userId;
  }

  /**
   * Send event to WebSocket client
   */
  private sendEvent(event: { type: string; data: any }) {
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (error: any) {
        logger.error('❌ Failed to send WebSocket event', {
          chatId: this.chatId,
          eventType: event.type,
          error: error.message,
        });
      }
    } else {
      logger.warn('⚠️ WebSocket not open, cannot send event', {
        chatId: this.chatId,
        eventType: event.type,
        readyState: this.ws.readyState,
      });
    }
  }

  /**
   * Called when LLM starts generating
   */
  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string
  ): Promise<void> {
    logger.info('🚀 Streaming: LLM started', {
      chatId: this.chatId,
      messageId: this.messageId,
      runId,
    });

    this.sendEvent({
      type: 'stream_start',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called for each new token from LLM
   */
  async handleLLMNewToken(
    token: string,
    runId: string
  ): Promise<void> {
    this.fullContent += token;

    this.sendEvent({
      type: 'stream_chunk',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        chunk: token,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when LLM finishes generating
   */
  async handleLLMEnd(
    output: any,
    runId: string
  ): Promise<void> {
    logger.info('✅ Streaming: LLM ended', {
      chatId: this.chatId,
      messageId: this.messageId,
      runId,
      contentLength: this.fullContent.length,
    });

    this.sendEvent({
      type: 'stream_end',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        fullContent: this.fullContent,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when LLM encounters an error
   */
  async handleLLMError(
    error: Error,
    runId: string
  ): Promise<void> {
    logger.error('❌ Streaming: LLM error', {
      chatId: this.chatId,
      messageId: this.messageId,
      runId,
      error: error.message,
    });

    this.sendEvent({
      type: 'error',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when a tool starts executing
   */
  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string
  ): Promise<void> {
    logger.info('🔧 Streaming: Tool started', {
      chatId: this.chatId,
      toolName: tool.name || tool.id?.[tool.id.length - 1],
      runId,
    });

    this.sendEvent({
      type: 'tool_start',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        toolName: tool.name || tool.id?.[tool.id.length - 1],
        input: input.substring(0, 200), // Truncate for safety
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when a tool finishes executing
   */
  async handleToolEnd(
    output: string,
    runId: string
  ): Promise<void> {
    logger.info('✅ Streaming: Tool ended', {
      chatId: this.chatId,
      runId,
      outputLength: output.length,
    });

    this.sendEvent({
      type: 'tool_end',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        output: output.substring(0, 500), // Truncate for safety
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when a tool encounters an error
   */
  async handleToolError(
    error: Error,
    runId: string
  ): Promise<void> {
    logger.error('❌ Streaming: Tool error', {
      chatId: this.chatId,
      runId,
      error: error.message,
    });

    this.sendEvent({
      type: 'tool_error',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when agent action is taken
   */
  async handleAgentAction(
    action: any,
    runId: string
  ): Promise<void> {
    logger.info('🤖 Streaming: Agent action', {
      chatId: this.chatId,
      tool: action.tool,
      runId,
    });

    this.sendEvent({
      type: 'agent_action',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        tool: action.tool,
        toolInput: action.toolInput,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when agent finishes
   */
  async handleAgentEnd(
    action: any,
    runId: string
  ): Promise<void> {
    logger.info('✅ Streaming: Agent ended', {
      chatId: this.chatId,
      runId,
    });

    this.sendEvent({
      type: 'agent_end',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Called when chain starts
   */
  async handleChainStart(
    chain: Serialized,
    inputs: any,
    runId: string
  ): Promise<void> {
    logger.debug('🔗 Streaming: Chain started', {
      chatId: this.chatId,
      chainName: chain.name || chain.id?.[chain.id.length - 1],
      runId,
    });
  }

  /**
   * Called when chain ends
   */
  async handleChainEnd(
    outputs: any,
    runId: string
  ): Promise<void> {
    logger.debug('✅ Streaming: Chain ended', {
      chatId: this.chatId,
      runId,
    });
  }

  /**
   * Called when chain encounters an error
   */
  async handleChainError(
    error: Error,
    runId: string
  ): Promise<void> {
    logger.error('❌ Streaming: Chain error', {
      chatId: this.chatId,
      runId,
      error: error.message,
    });

    this.sendEvent({
      type: 'error',
      data: {
        messageId: this.messageId,
        chatId: this.chatId,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
