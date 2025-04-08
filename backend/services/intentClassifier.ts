import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export interface Intent {
  name: string;
  confidence: number;
  entities?: {
    [key: string]: string | number | boolean;
  };
}

export class IntentClassifierService {
  private client: BedrockRuntimeClient;
  private modelId: string = "anthropic.claude-3-5-sonnet-20240620-v1:0"; // Use Claude 3.5 Sonnet
  
  // Define our intents
  private readonly intents = [
    {
      name: "greeting",
      description: "User is greeting or starting a conversation",
      examples: ["hello", "hi there", "good morning", "สวัสดี", "สวัสดีครับ/ค่ะ"]
    },
    {
      name: "enrollment_inquiry",
      description: "Questions about enrollment, registration, or admission",
      examples: ["How do I enroll in a course?", "What's the registration process?", "วิธีการลงทะเบียนเรียน", "ขั้นตอนการสมัครเรียน"]
    },
    {
      name: "schedule_inquiry", 
      description: "Questions about class schedules, exam dates, or academic calendar",
      examples: ["When does the semester start?", "What's the exam schedule?", "ตารางเรียน", "วันสอบ"]
    },
    {
      name: "course_inquiry",
      description: "Questions about specific courses, requirements, or content",
      examples: ["What courses are available?", "Tell me about the CS program", "วิชาที่เปิดสอน", "หลักสูตร"]
    },
    {
      name: "facility_inquiry",
      description: "Questions about facilities, locations, or services",
      examples: ["Where is the library?", "How do I access the lab?", "ห้องสมุดอยู่ที่ไหน", "บริการต่างๆ"]
    },
    {
      name: "academic_help",
      description: "Requests for academic assistance or explanations",
      examples: ["Can you explain this concept?", "Help me understand this topic", "อธิบายเรื่องนี้", "ช่วยสอนหน่อย"]
    },
    {
      name: "technical_help",
      description: "Technical issues or IT support requests",
      examples: ["My account isn't working", "How do I reset my password?", "ปัญหาระบบ", "รีเซ็ตรหัสผ่าน"]
    },
    {
      name: "feedback",
      description: "Providing feedback or opinions",
      examples: ["I think the system should...", "This service is great", "ข้อเสนอแนะ", "ความคิดเห็น"]
    },
    {
      name: "gratitude",
      description: "Expressing thanks or appreciation",
      examples: ["Thank you", "Thanks for your help", "ขอบคุณ", "ขอบคุณสำหรับความช่วยเหลือ"]
    },
    {
      name: "farewell",
      description: "Ending the conversation",
      examples: ["Goodbye", "Talk to you later", "ลาก่อน", "แล้วพบกันใหม่"]
    },
    {
      name: "image_generation",
      description: "Request to generate or create a new image",
      examples: ["Create an image of", "Generate a picture of", "Draw a", "สร้างรูปภาพ", "วาดรูป"]
    },
    {
      name: "image_analysis",
      description: "Request to analyze, describe, or explain an image",
      examples: ["What's in this image?", "Describe this picture", "Analyze this image", "วิเคราะห์รูปภาพนี้", "อธิบายภาพนี้"]
    },
    {
      name: "other",
      description: "Other inquiries that don't fit in defined categories",
      examples: ["Random question", "Something else", "คำถามอื่นๆ"]
    }
  ];
  
  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }
  
  /**
   * Classify the intent of a user message
   */
  async classifyIntent(message: string): Promise<Intent[]> {
    try {
      console.log('Starting intent classification for message:', message);
      
      // Construct a prompt for intent classification
      const prompt = this.buildIntentClassificationPrompt(message);
      console.log('Built classification prompt');
      
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 500,
          temperature: 0.1, // Very low temperature for deterministic responses
          system: "You are an expert intent classifier for a university chatbot. Analyze the user's message and determine the most likely intent. Output ONLY valid JSON.",
          messages: [
            {
              role: "user", 
              content: prompt
            }
          ]
        })
      });
      
      console.log(`Sending classification request to model: ${this.modelId}`);
      const response = await this.client.send(command);
      console.log('Received response from model');
      
      if (!response.body) {
        throw new Error("Empty response body from Bedrock");
      }
      
      const responseText = new TextDecoder().decode(response.body);
      const parsedResponse = JSON.parse(responseText);
      
      if (!parsedResponse.content || !parsedResponse.content[0] || !parsedResponse.content[0].text) {
        throw new Error("Unexpected response format from Bedrock");
      }
      
      // Extract the JSON from the response
      const responseContent = parsedResponse.content[0].text;
      console.log('Raw model response:', responseContent);
      
      // Parse the JSON response
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        let jsonStr = responseContent;
        if (responseContent.includes("```json")) {
          jsonStr = responseContent.split("```json")[1].split("```")[0].trim();
        } else if (responseContent.includes("```")) {
          jsonStr = responseContent.split("```")[1].split("```")[0].trim();
        }
        
        const intentResult = JSON.parse(jsonStr) as Intent[];
        console.log('Successfully parsed intent classification result:', JSON.stringify(intentResult, null, 2));
        return intentResult;
      } catch (parseError) {
        console.error("Error parsing intent classification response:", parseError);
        return [{ name: "other", confidence: 1.0 }];
      }
    } catch (error) {
      console.error("Error classifying intent:", error);
      return [{ name: "other", confidence: 1.0 }];
    }
  }
  
  /**
   * Build a prompt for intent classification
   */
  private buildIntentClassificationPrompt(message: string): string {
    const intentDefinitions = this.intents.map(intent => 
      `${intent.name}: ${intent.description}\nExamples: ${intent.examples.join(", ")}`
    ).join("\n\n");
    
    return `
Below are the intent categories to classify user messages:

${intentDefinitions}

User message: "${message}"

Analyze the user message and determine which intent categories apply. Consider the context, keywords, and patterns in the message.

Respond with a JSON array of intents, ordered by confidence (highest first). Include at least one and at most three intents, with confidence scores that sum to 1.0.

For the most likely intent, extract any relevant entities from the message.

Example response format:
[
  {
    "name": "intent_name",
    "confidence": 0.8,
    "entities": {
      "entity_name": "entity_value"
    }
  },
  {
    "name": "another_intent",
    "confidence": 0.2
  }
]

Ensure your response is valid JSON and follows the exact format above. DO NOT include any explanations or text outside of the JSON array.
    `;
  }
  
  /**
   * Parse an existing message to determine intent for analytics or specialized handling
   */
  async analyzeMessage(message: string): Promise<{
    intent: string;
    entities?: {[key: string]: any};
    confidence: number;
  }> {
    console.log('Analyzing message for intent:', message);
    const intents = await this.classifyIntent(message);
    const topIntent = intents[0];
    
    console.log('Analysis complete. Top intent:', topIntent.name, 'with confidence:', topIntent.confidence);
    return {
      intent: topIntent.name,
      entities: topIntent.entities,
      confidence: topIntent.confidence
    };
  }
}

export const intentClassifierService = new IntentClassifierService(); 