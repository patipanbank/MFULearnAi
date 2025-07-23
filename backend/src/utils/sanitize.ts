import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target']
  });
};

/**
 * Sanitize plain text by removing potentially dangerous characters
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 10000); // Limit length
};

/**
 * Sanitize agent data before sending to frontend
 */
export const sanitizeAgent = (agent: any) => {
  if (!agent) return null;
  
  const obj = agent.toObject ? agent.toObject() : agent;
  
  return {
    ...obj,
    name: sanitizeText(obj.name || ''),
    description: sanitizeText(obj.description || ''),
    systemPrompt: sanitizeText(obj.systemPrompt || ''),
    modelId: sanitizeText(obj.modelId || ''),
    tags: Array.isArray(obj.tags) ? obj.tags.map(sanitizeText) : [],
    collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames.map(sanitizeText) : [],
    tools: Array.isArray(obj.tools) ? obj.tools.map((tool: any) => ({
      ...tool,
      name: sanitizeText(tool.name || ''),
      description: sanitizeText(tool.description || '')
    })) : []
  };
};

/**
 * Sanitize array of agents
 */
export const sanitizeAgents = (agents: any[]): any[] => {
  if (!Array.isArray(agents)) return [];
  
  return agents.map(sanitizeAgent).filter(Boolean);
};

/**
 * Validate and sanitize email address
 */
export const sanitizeEmail = (email: string): string | null => {
  if (!email) return null;
  
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(sanitized) ? sanitized : null;
};

/**
 * Sanitize URL
 */
export const sanitizeUrl = (url: string): string | null => {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return null;
    }
    return urlObj.toString();
  } catch {
    return null;
  }
};

/**
 * Sanitize MongoDB ObjectId
 */
export const sanitizeObjectId = (id: string): string | null => {
  if (!id || typeof id !== 'string') return null;
  
  // MongoDB ObjectId is 24 characters hex string
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  return objectIdRegex.test(id) ? id : null;
}; 