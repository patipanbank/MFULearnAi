import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

// Intent types for classification
export enum IntentType {
  INFORMATION = 'information',         // Looking for factual information
  PROCEDURAL = 'procedural',           // How to do something
  COMPARISON = 'comparison',           // Comparing options
  CLARIFICATION = 'clarification',     // Asking for more details
  DECISION_SUPPORT = 'decision_support', // Help making a decision
  OPINION = 'opinion',                 // Looking for opinions or perspective
  TROUBLESHOOTING = 'troubleshooting'  // Solving a problem
}

// Entity types for extraction
export enum EntityType {
  PERSON = 'person',
  LOCATION = 'location',
  ORGANIZATION = 'organization',
  DATE_TIME = 'datetime',
  COURSE = 'course',
  FACULTY = 'faculty',
  SUBJECT = 'subject',
  DEPARTMENT = 'department',
  POLICY = 'policy',
  EVENT = 'event',
  PROCESS = 'process'
}

// Condition types for logical operations
export enum ConditionType {
  IF = 'if',
  UNLESS = 'unless',
  BUT = 'but',
  AND = 'and',
  OR = 'or',
  WHEN = 'when',
  WHILE = 'while'
}

// Context type for context handling
export interface ContextInfo {
  previousQuestions: string[];
  relevantEntities: Record<string, any>;
  currentTopic?: string;
  references?: string[];
}

// Entity information
export interface Entity {
  type: EntityType;
  value: string;
  start: number;
  end: number;
  metadata?: Record<string, any>;
}

// Condition information for logical operations
export interface Condition {
  type: ConditionType;
  expression: string;
  start: number;
  end: number;
}

// Complete question analysis result
export interface QuestionAnalysis {
  originalQuestion: string;
  preprocessedQuestion: string;
  intent: IntentType;
  entities: Entity[];
  conditions: Condition[];
  context: ContextInfo;
  questionComplexity: number; // 1-10 scale
  keywords: string[];
  language: string;
  customPrompt: string;
  requiresExternalData: boolean;
}

export class QuestionAnalysisService {
  private readonly intentPatterns: Record<IntentType, RegExp[]> = {
    [IntentType.INFORMATION]: [
      /^(what|when|where|who|which|how many|how much)/i,
      /tell me about/i,
      /information (on|about)/i,
      /do you know/i
    ],
    [IntentType.PROCEDURAL]: [
      /^(how to|how do I|what steps|how can I|show me how)/i,
      /steps to/i,
      /process (of|for)/i,
      /guide for/i
    ],
    [IntentType.COMPARISON]: [
      /compare|vs\.?|versus|difference between|similarities between/i,
      /better (option|choice|alternative)/i,
      /which (is|are) better/i
    ],
    [IntentType.CLARIFICATION]: [
      /^(can you clarify|what do you mean|please explain|could you elaborate)/i,
      /I don't understand/i,
      /confus(ed|ing)/i
    ],
    [IntentType.DECISION_SUPPORT]: [
      /should I|recommend|suggest|advise|best option/i,
      /help me (decide|choose|select)/i,
      /what would you (recommend|suggest)/i
    ],
    [IntentType.OPINION]: [
      /what (do|would) you think/i,
      /your (opinion|thoughts|perspective)/i,
      /do you (believe|think|feel)/i
    ],
    [IntentType.TROUBLESHOOTING]: [
      /^(troubleshoot|fix|solve|resolve|debug)/i,
      /not working|error|issue|problem|broken/i,
      /how (to fix|to solve|to resolve|to troubleshoot)/i
    ]
  };

  private readonly entityPatterns: Record<EntityType, RegExp[]> = {
    [EntityType.PERSON]: [
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/,
      /\bDr\.\s+[A-Z][a-z]+\b/,
      /\bProf\.\s+[A-Z][a-z]+\b/,
      /\bProfessor\s+[A-Z][a-z]+\b/
    ],
    [EntityType.LOCATION]: [
      /\b(room|building|hall|floor|campus|office)\s+\w+\b/i,
      /\b(C|M|D|E|S)\d+\b/, // MFU Building codes
      /\bM-Square\b/,
      /\bLearning Center\b/
    ],
    [EntityType.ORGANIZATION]: [
      /\b(School|Faculty) of \w+\b/,
      /\bMFU\b/,
      /\bMae Fah Luang\b/,
      /\bUniversity\b/,
      /\bDepartment of \w+\b/
    ],
    [EntityType.DATE_TIME]: [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?\b/i,
      /\b(yesterday|today|tomorrow|next week|last week|next month|last month)\b/i,
      /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i
    ],
    [EntityType.COURSE]: [
      /\b[A-Z]{2,4}\d{3,4}\b/, // Course codes like CS101
      /\bcourse\s+(?:on|in|about)\s+\w+/i
    ],
    [EntityType.FACULTY]: [
      /\bFaculty of \w+\b/,
      /\bSchool of \w+\b/
    ],
    [EntityType.SUBJECT]: [
      /\b(Mathematics|Physics|Chemistry|Biology|Computer Science|Engineering|Literature|History|Psychology|Economics|Business)\b/i
    ],
    [EntityType.DEPARTMENT]: [
      /\bDepartment of \w+\b/,
      /\b(IT|HR|Finance|Marketing|Admissions|Registration|International Affairs)\s+Department\b/
    ],
    [EntityType.POLICY]: [
      /\bpolicy\s+(?:on|for|regarding)\s+\w+/i,
      /\bregulations?\b/i,
      /\brules?\b/i
    ],
    [EntityType.EVENT]: [
      /\b(orientation|graduation|ceremony|seminar|workshop|conference|meeting|exam)\b/i
    ],
    [EntityType.PROCESS]: [
      /\bprocess\s+(?:of|for)\s+\w+/i,
      /\bprocedure\s+(?:for|to)\s+\w+/i,
      /\bsteps?\s+(?:for|to)\s+\w+/i
    ]
  };

  private readonly conditionPatterns: Record<ConditionType, RegExp[]> = {
    [ConditionType.IF]: [
      /\bif\b\s+([^,.?!]*)/i
    ],
    [ConditionType.UNLESS]: [
      /\bunless\b\s+([^,.?!]*)/i
    ],
    [ConditionType.BUT]: [
      /\bbut\b\s+([^,.?!]*)/i
    ],
    [ConditionType.AND]: [
      /\band\b\s+([^,.?!]*)/i
    ],
    [ConditionType.OR]: [
      /\bor\b\s+([^,.?!]*)/i
    ],
    [ConditionType.WHEN]: [
      /\bwhen\b\s+([^,.?!]*)/i
    ],
    [ConditionType.WHILE]: [
      /\bwhile\b\s+([^,.?!]*)/i
    ]
  };

  private readonly ruleBasedPreprocessingRules: Array<{ pattern: RegExp, replacement: string | ((match: string, ...args: string[]) => string) }> = [
    // Normalize spacing
    { pattern: /\s+/g, replacement: ' ' },
    
    // Handle common abbreviations
    { pattern: /\bMFU\b/g, replacement: 'Mae Fah Luang University' },
    { pattern: /\bw\/\b/g, replacement: 'with' },
    { pattern: /\bw\/o\b/g, replacement: 'without' },
    { pattern: /\bpls\b/g, replacement: 'please' },
    { pattern: /\bthx\b/g, replacement: 'thanks' },
    
    // Formalize questions that don't end with a question mark
    { pattern: /^(what|how|when|where|why|who|which).*[^?]$/i, replacement: (match: string) => match + '?' },
    
    // Add missing prefixes to make it a complete question
    { pattern: /^([a-z].+\?)/i, replacement: (match: string, p1: string) => {
      if (!/^(what|how|when|where|why|who|which|is|are|can|could|would|should|do|does|will)/i.test(p1)) {
        return `What about ${p1}`;
      }
      return match;
    }}
  ];

  private readonly languageDetectionPatterns: Record<string, RegExp[]> = {
    'english': [/^[a-zA-Z\s.,?!;:()\-'\"]+$/],
    'thai': [/[\u0E00-\u0E7F]/], // Thai Unicode range
    'chinese': [/[\u4E00-\u9FFF]/], // Chinese Unicode range
    'japanese': [/[\u3040-\u309F\u30A0-\u30FF]/], // Japanese Unicode ranges
  };

  private getMFUSpecificKeywords(): Record<string, string[]> {
    return {
      'registration': ['enrollment', 'register', 'sign up', 'join', 'class registration'],
      'courses': ['classes', 'subjects', 'curriculum', 'study program', 'electives'],
      'graduation': ['degree', 'graduate', 'commencement', 'convocation', 'alumni'],
      'facilities': ['library', 'dormitory', 'canteen', 'sports center', 'lab'],
      'staff': ['professors', 'lecturers', 'faculty', 'instructors', 'teachers', 'advisors'],
      'events': ['orientation', 'open house', 'ceremony', 'festival', 'seminar'],
      'international': ['exchange program', 'study abroad', 'overseas', 'foreign students']
    };
  }

  // Handle context using previous messages
  private extractContextFromHistory(messages: ChatMessage[]): ContextInfo {
    const previousQuestions: string[] = [];
    const relevantEntities: Record<string, any> = {};
    
    // Only look at the last 5 user messages for context
    const userMessages = messages
      .filter(msg => msg.role === 'user')
      .slice(-5);
    
    userMessages.forEach(msg => {
      previousQuestions.push(msg.content);
      
      // Extract entities from previous questions to build context
      const entities = this.extractEntities(msg.content);
      entities.forEach(entity => {
        if (!relevantEntities[entity.type]) {
          relevantEntities[entity.type] = [];
        }
        if (!relevantEntities[entity.type].includes(entity.value)) {
          relevantEntities[entity.type].push(entity.value);
        }
      });
    });

    // Try to identify the current topic from the history
    let currentTopic: string | undefined;
    if (previousQuestions.length > 0) {
      const mfuKeywords = this.getMFUSpecificKeywords();
      
      // Look for topic matches in the recent conversation
      for (const [topic, keywords] of Object.entries(mfuKeywords)) {
        const matchFound = keywords.some(keyword => 
          previousQuestions.some(q => q.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        if (matchFound) {
          currentTopic = topic;
          break;
        }
      }
    }

    return {
      previousQuestions,
      relevantEntities,
      currentTopic
    };
  }

  // Rule-based preprocessing to clean and normalize the query
  private preprocessQuestion(question: string): string {
    let processedQuestion = question.trim();
    
    // Apply all preprocessing rules
    this.ruleBasedPreprocessingRules.forEach(rule => {
      if (typeof rule.replacement === 'string') {
        processedQuestion = processedQuestion.replace(rule.pattern, rule.replacement);
      } else {
        processedQuestion = processedQuestion.replace(rule.pattern, rule.replacement);
      }
    });
    
    return processedQuestion;
  }

  // Identify the intent of the question
  private classifyIntent(question: string): IntentType {
    const lowerQuestion = question.toLowerCase();
    
    // Check each intent pattern
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerQuestion)) {
          return intent as IntentType;
        }
      }
    }
    
    // Default to information intent if no match
    return IntentType.INFORMATION;
  }

  // Extract named entities from the question
  private extractEntities(question: string): Entity[] {
    const entities: Entity[] = [];
    
    // Check for each entity type
    for (const [entityType, patterns] of Object.entries(this.entityPatterns)) {
      for (const pattern of patterns) {
        const matches = [...question.matchAll(new RegExp(pattern, 'g'))];
        
        matches.forEach(match => {
          if (match.index !== undefined) {
            entities.push({
              type: entityType as EntityType,
              value: match[0],
              start: match.index,
              end: match.index + match[0].length
            });
          }
        });
      }
    }
    
    return entities;
  }

  // Extract conditional expressions from the question
  private extractConditions(question: string): Condition[] {
    const conditions: Condition[] = [];
    
    // Check for each condition type
    for (const [conditionType, patterns] of Object.entries(this.conditionPatterns)) {
      for (const pattern of patterns) {
        const matches = [...question.matchAll(new RegExp(pattern, 'g'))];
        
        matches.forEach(match => {
          if (match.index !== undefined && match[1]) {
            conditions.push({
              type: conditionType as ConditionType,
              expression: match[1].trim(),
              start: match.index,
              end: match.index + match[0].length
            });
          }
        });
      }
    }
    
    return conditions;
  }

  // Determine the complexity of the question on a scale of 1-10
  private calculateQuestionComplexity(question: string, entities: Entity[], conditions: Condition[]): number {
    let complexity = 1; // Start with base complexity
    
    // Add complexity based on question length
    complexity += Math.min(3, question.split(' ').length / 10);
    
    // Add complexity based on entity count
    complexity += Math.min(2, entities.length / 2);
    
    // Add complexity based on conditions
    complexity += Math.min(2, conditions.length);
    
    // Check for complex question structures
    if (/why|how/i.test(question)) complexity += 1;
    if (/compare|difference|similarities/i.test(question)) complexity += 1;
    if (/relationship|correlation|cause|effect/i.test(question)) complexity += 1;
    
    // Ensure the value is between 1-10
    return Math.min(10, Math.max(1, Math.round(complexity)));
  }

  // Extract keywords from the question
  private extractKeywords(question: string): string[] {
    // Simple keyword extraction by removing stop words
    const stopWords = new Set([
      'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 
      'of', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
      'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how',
      'what', 'which', 'who', 'whom', 'whose', 'that', 'there'
    ]);
    
    return question
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(' ')
      .filter(word => !stopWords.has(word) && word.length > 1);
  }

  // Detect the language of the question
  private detectLanguage(question: string): string {
    for (const [language, patterns] of Object.entries(this.languageDetectionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(question)) {
          return language;
        }
      }
    }
    
    return 'english'; // Default to English if no match
  }

  // Generate a custom prompt based on the analysis
  private generateCustomPrompt(analysis: Partial<QuestionAnalysis>): string {
    const prompts: string[] = [];
    
    // Add intent-specific prompt
    switch (analysis.intent) {
      case IntentType.INFORMATION:
        prompts.push(`Please provide accurate and concise information about ${analysis.keywords?.join(', ')}`);
        break;
      case IntentType.PROCEDURAL:
        prompts.push(`Please outline the step-by-step process for ${analysis.originalQuestion?.replace(/^how to /i, '')}`);
        break;
      case IntentType.COMPARISON:
        const comparisonItems = analysis.entities?.filter(e => e.type !== EntityType.DATE_TIME).map(e => e.value) || [];
        prompts.push(`Please compare the following items: ${comparisonItems.join(', ')}`);
        break;
      case IntentType.CLARIFICATION:
        prompts.push(`Please clarify the following: ${analysis.originalQuestion}`);
        break;
      case IntentType.DECISION_SUPPORT:
        prompts.push(`Please provide decision support for: ${analysis.originalQuestion}`);
        break;
      case IntentType.OPINION:
        prompts.push(`Please provide a balanced perspective on: ${analysis.originalQuestion}`);
        break;
      case IntentType.TROUBLESHOOTING:
        prompts.push(`Please help troubleshoot this issue: ${analysis.originalQuestion}`);
        break;
      default:
        prompts.push(`Please answer: ${analysis.originalQuestion}`);
    }
    
    // Add entity-specific context
    if (analysis.entities && analysis.entities.length > 0) {
      const entityGroups: Record<string, string[]> = {};
      
      // Group entities by type
      analysis.entities.forEach(entity => {
        if (!entityGroups[entity.type]) {
          entityGroups[entity.type] = [];
        }
        entityGroups[entity.type].push(entity.value);
      });
      
      // Add each entity group to the prompt
      for (const [type, values] of Object.entries(entityGroups)) {
        prompts.push(`Regarding ${type}(s): ${values.join(', ')}`);
      }
    }
    
    // Add condition handling
    if (analysis.conditions && analysis.conditions.length > 0) {
      analysis.conditions.forEach(condition => {
        prompts.push(`${condition.type.toUpperCase()}: ${condition.expression}`);
      });
    }
    
    // Add complexity guideline
    if (analysis.questionComplexity) {
      if (analysis.questionComplexity <= 3) {
        prompts.push('Please provide a simple and concise answer.');
      } else if (analysis.questionComplexity <= 7) {
        prompts.push('Please provide a moderate detailed answer with key points.');
      } else {
        prompts.push('Please provide a comprehensive and detailed answer.');
      }
    }
    
    // Add context from previous conversation if available
    if (analysis.context?.currentTopic) {
      prompts.push(`This question is related to the topic: ${analysis.context.currentTopic}`);
    }
    
    // Add language preference
    if (analysis.language && analysis.language !== 'english') {
      prompts.push(`Please respond in ${analysis.language}.`);
    }
    
    return prompts.join('\n');
  }

  // Determine if the question requires external data
  private requiresExternalData(question: string, intent: IntentType, entities: Entity[]): boolean {
    // Check for current/updated data indicators
    if (/current|latest|recent|update|today|now/i.test(question)) {
      return true;
    }
    
    // Check if it's about specific MFU entities that would need updated information
    const mfuSpecificEntities = entities.filter(e => 
      [EntityType.COURSE, EntityType.EVENT, EntityType.POLICY].includes(e.type)
    );
    
    if (mfuSpecificEntities.length > 0) {
      return true;
    }
    
    // Check if it's a procedural question that might need precise current instructions
    if (intent === IntentType.PROCEDURAL && 
        /register|apply|reserve|book|schedule|find|locate|access/i.test(question)) {
      return true;
    }
    
    return false;
  }

  // Main analysis method
  public analyzeQuestion(question: string, messages: ChatMessage[] = []): QuestionAnalysis {
    // Step 1: Rule-based preprocessing
    const preprocessedQuestion = this.preprocessQuestion(question);
    
    // Step 2: Intent classification
    const intent = this.classifyIntent(preprocessedQuestion);
    
    // Step 3: Entity extraction
    const entities = this.extractEntities(preprocessedQuestion);
    
    // Step 4: Condition/logic parsing
    const conditions = this.extractConditions(preprocessedQuestion);
    
    // Step 5: Context handling from history
    const context = this.extractContextFromHistory(messages);
    
    // Step 6: Calculate question complexity
    const questionComplexity = this.calculateQuestionComplexity(
      preprocessedQuestion, 
      entities, 
      conditions
    );
    
    // Step 7: Extract keywords
    const keywords = this.extractKeywords(preprocessedQuestion);
    
    // Step 8: Language detection
    const language = this.detectLanguage(preprocessedQuestion);
    
    // Step 9: Check if external data is needed
    const requiresExternalData = this.requiresExternalData(
      preprocessedQuestion,
      intent,
      entities
    );
    
    // Step 10: Create analysis object
    const analysis: QuestionAnalysis = {
      originalQuestion: question,
      preprocessedQuestion,
      intent,
      entities,
      conditions,
      context,
      questionComplexity,
      keywords,
      language,
      requiresExternalData,
      customPrompt: '' // Will be generated next
    };
    
    // Step 11: Generate custom prompt
    analysis.customPrompt = this.generateCustomPrompt(analysis);
    
    return analysis;
  }
}

// Export a singleton instance
export const questionAnalysisService = new QuestionAnalysisService(); 