export class EvaluationService {
  async evaluateResponse(response: string, context: string) {
    try {
      // Source attribution check
      const hasSourceAttribution = response.includes('According to') || response.includes('Based on');
      
      // Consistency with context
      const contextKeywords = new Set(context.toLowerCase().split(' '));
      const responseKeywords = new Set(response.toLowerCase().split(' '));
      const commonKeywords = [...contextKeywords].filter(x => responseKeywords.has(x));
      const consistency = commonKeywords.length / contextKeywords.size;

      // Hallucination detection (basic)
      const potentialHallucination = response.includes('I think') || 
                                   response.includes('probably') ||
                                   response.includes('maybe');

      return {
        hasSourceAttribution,
        consistency,
        potentialHallucination,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Evaluation error:', error);
      return null;
    }
  }
}

export const evaluationService = new EvaluationService();