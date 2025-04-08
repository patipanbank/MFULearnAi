import nlp from 'compromise';

/**
 * Tokenization utility class for preprocessing text before embedding.
 * This provides multiple tokenization strategies to optimize query processing for embeddings.
 */
export class Tokenizer {
  // Cache for tokenized questions to avoid repeated processing
  private static tokenCache = new Map<string, string>();
  private static readonly CACHE_SIZE = 1000;

  /**
   * Apply standard tokenization to a question
   * - Normalizes text (lowercase, remove extra whitespace)
   * - Splits into tokens using the compromise NLP library
   * - Extracts key entities and their relationships
   * - Reorders tokens based on importance
   * 
   * @param question The question text to tokenize
   * @returns Optimized tokenized text ready for embedding
   */
  static tokenizeQuestion(question: string): string {
    // Check cache first
    const cacheKey = question.trim();
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey) || '';
    }

    // Normalize the question text
    let normalizedText = question.trim().toLowerCase();
    normalizedText = normalizedText.replace(/\s+/g, ' ');

    // Use compromise for NLP processing
    const doc = nlp(normalizedText);
    
    // Process and extract key components
    const entities = doc.topics().json({ normal: true });
    const verbs = doc.verbs().json({ normal: true });
    const nouns = doc.nouns().json({ normal: true });
    
    // Create enhanced tokens list with priority weighting
    const tokens: string[] = [];
    
    // Add topic entities first (most important)
    for (const entity of entities) {
      tokens.push(entity.normal || entity.text || '');
    }
    
    // Add main verbs (actions)
    for (const verb of verbs) {
      const verbText = verb.normal || verb.text || '';
      if (verbText && !tokens.includes(verbText)) {
        tokens.push(verbText);
      }
    }
    
    // Add remaining nouns
    for (const noun of nouns) {
      const nounText = noun.normal || noun.text || '';
      if (nounText && !tokens.includes(nounText)) {
        tokens.push(nounText);
      }
    }
    
    // Add any remaining significant words (adjectives, adverbs)
    const words = doc.terms()
      .not('#Determiner, #Preposition, #Conjunction, #Pronoun')
      .json({ normal: true });
      
    for (const word of words) {
      const wordText = word.normal || word.text || '';
      if (wordText && !tokens.includes(wordText) && wordText.length > 2) {
        tokens.push(wordText);
      }
    }
    
    // Reconstruct the question with optimized token order
    // Start with original text for context preservation
    let tokenizedText = normalizedText;
    
    // Append extracted tokens, prioritizing important entities
    if (tokens.length > 0) {
      tokenizedText += ` [key: ${tokens.join(' ')}]`;
    }
    
    // Manage cache size
    if (this.tokenCache.size >= this.CACHE_SIZE) {
      const firstKey = this.tokenCache.keys().next().value;
      if (firstKey) {
        this.tokenCache.delete(firstKey);
      }
    }
    
    // Store in cache
    this.tokenCache.set(cacheKey, tokenizedText);
    
    return tokenizedText;
  }

  /**
   * Simple tokenization method using unicode-aware splitting
   * 
   * @param text The text to tokenize
   * @returns Array of tokens (words/subwords)
   */
  static getBasicTokens(text: string): string[] {
    // Remove extra whitespace
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Split on word boundaries with unicode support
    const wordPattern = /\b(\w+)\b/gu;
    const matches = cleanText.matchAll(wordPattern);
    
    return Array.from(matches).map(match => match[0]);
  }

  /**
   * Extracts key phrases from a question
   * 
   * @param question The question to process
   * @returns Array of important phrases
   */
  static extractKeyPhrases(question: string): string[] {
    const doc = nlp(question);
    
    // Extract noun phrases (most important for semantic meaning)
    const nounPhrases = doc.match('#Noun+').out('array');
    
    // Extract verb phrases
    const verbPhrases = doc.match('#Verb+ #Preposition? #Determiner? #Adjective? #Noun+').out('array');
    
    // Extract questions (who, what, where, etc.)
    const questionWords = doc.match('#QuestionWord').out('array');
    
    // Combine all important phrases
    return [...new Set([...nounPhrases, ...verbPhrases, ...questionWords])];
  }

  /**
   * Calculate token count for text using basic tokenization
   * 
   * @param text Text to count tokens for
   * @returns Number of tokens
   */
  static countTokens(text: string): number {
    return this.getBasicTokens(text).length;
  }
}

/**
 * Enhance a question with additional context before embedding
 * 
 * @param question Original question text
 * @returns Enhanced question ready for embedding
 */
export function enhanceQueryForEmbedding(question: string): string {
  // Apply the tokenization process
  const tokenizedQuestion = Tokenizer.tokenizeQuestion(question);
  
  // Extract key phrases 
  const keyPhrases = Tokenizer.extractKeyPhrases(question);
  
  // Create enhanced query with semantic markers
  let enhancedQuery = tokenizedQuestion;
  
  // Add key phrases if available
  if (keyPhrases.length > 0) {
    enhancedQuery += ` [phrases: ${keyPhrases.join(' | ')}]`;
  }
  
  return enhancedQuery;
} 