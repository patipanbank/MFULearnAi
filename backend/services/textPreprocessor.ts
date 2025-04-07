/**
 * Text Preprocessor Service
 * 
 * This service handles text preprocessing tasks such as:
 * - Normalization
 * - Language detection
 * - Text cleaning
 * - Special character handling
 * - Tokenization preparation
 */

class TextPreprocessorService {
  /**
   * Preprocess text before analysis
   * 
   * @param text The input text to process
   * @returns Preprocessed text ready for sentiment analysis
   */
  async preprocess(text: string): Promise<string> {
    // Step 1: Basic cleaning
    let processedText = this.basicCleaning(text);
    
    // Step 2: Normalize whitespace
    processedText = this.normalizeWhitespace(processedText);
    
    // Step 3: Handle special characters
    processedText = this.handleSpecialCharacters(processedText);
    
    // Step 4: Truncate if too long (most models have token limits)
    processedText = this.truncateIfNeeded(processedText);
    
    return processedText;
  }

  /**
   * Clean basic text issues
   */
  private basicCleaning(text: string): string {
    // Convert to string if not already
    if (typeof text !== 'string') {
      text = String(text);
    }
    
    // Remove redundant spaces
    let cleaned = text.trim();
    
    // Handle null or empty text
    if (!cleaned) {
      return '';
    }
    
    return cleaned;
  }

  /**
   * Normalize whitespace in text
   */
  private normalizeWhitespace(text: string): string {
    // Replace multiple spaces, tabs, newlines with single space
    return text.replace(/\s+/g, ' ');
  }

  /**
   * Handle special characters that might affect analysis
   */
  private handleSpecialCharacters(text: string): string {
    // Replace emojis with text representation if needed
    // This is a simple approach. For production, consider more complex emoji detection
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    
    // For this implementation, we'll keep emojis since they can convey sentiment
    
    // Handle quotes consistently
    let processed = text.replace(/[""]/g, '"');
    processed = processed.replace(/['']/g, "'");
    
    return processed;
  }

  /**
   * Truncate text if it exceeds maximum length
   */
  private truncateIfNeeded(text: string, maxLength: number = 1000): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to cut at a sentence boundary if possible
    const truncated = text.substring(0, maxLength);
    const lastPeriodIndex = truncated.lastIndexOf('.');
    
    if (lastPeriodIndex > maxLength * 0.7) {
      // If there's a period in the latter part of the text, cut there
      return truncated.substring(0, lastPeriodIndex + 1);
    }
    
    return truncated + '...';
  }
}

export const textPreprocessor = new TextPreprocessorService(); 