import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export interface Intent {
  name: string;
  confidence: number;
  entities?: {
    [key: string]: string | number | boolean;
  };
}

export interface Topic {
  name: string;
  confidence: number;
  subtopics?: string[];
}

export interface ClassificationResult {
  intents: Intent[];
  topics: Topic[];
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
  
  // Define our topics
  private readonly topics = [
    {
      name: "admission",
      description: "Topics related to university admission, application process, requirements",
      examples: ["admission requirements", "how to apply", "application deadline", "การรับสมัคร", "วิธีสมัคร"]
    },
    {
      name: "tuition",
      description: "Topics related to tuition fees, payment methods, financial aid",
      examples: ["tuition cost", "payment deadline", "scholarships", "ค่าเทอม", "ทุนการศึกษา"]
    },
    {
      name: "academic_programs",
      description: "Topics related to degree programs, majors, concentrations",
      examples: ["available majors", "degree requirements", "หลักสูตร", "สาขาวิชา"]
    },
    {
      name: "courses",
      description: "Topics related to specific courses, course content, requirements",
      examples: ["course description", "prerequisites", "รายวิชา", "คำอธิบายรายวิชา"]
    },
    {
      name: "examinations",
      description: "Topics related to exams, grading, assessments",
      examples: ["exam schedule", "grading system", "กำหนดการสอบ", "การวัดผล"]
    },
    {
      name: "registration",
      description: "Topics related to course registration, add/drop periods",
      examples: ["how to register", "add/drop period", "การลงทะเบียน", "เพิ่ม-ถอนรายวิชา"]
    },
    {
      name: "academic_calendar",
      description: "Topics related to important academic dates, semesters",
      examples: ["semester dates", "holidays", "ปฏิทินการศึกษา", "วันเปิดภาคเรียน"]
    },
    {
      name: "campus_facilities",
      description: "Topics related to university facilities, buildings, services",
      examples: ["library hours", "sports complex", "สิ่งอำนวยความสะดวก", "ห้องสมุด"]
    },
    {
      name: "student_services",
      description: "Topics related to student support services, counseling",
      examples: ["counseling services", "health center", "บริการนักศึกษา", "หน่วยแนะแนว"]
    },
    {
      name: "housing",
      description: "Topics related to dormitories, on/off-campus housing",
      examples: ["dormitory application", "housing costs", "หอพัก", "ที่พักนักศึกษา"]
    },
    {
      name: "technology",
      description: "Topics related to IT services, online systems, accounts",
      examples: ["wifi access", "student email", "technology help", "ระบบอินเทอร์เน็ต", "บัญชีนักศึกษา"]
    },
    {
      name: "extracurricular",
      description: "Topics related to clubs, activities, events",
      examples: ["student clubs", "events", "ชมรม", "กิจกรรมนักศึกษา"]
    },
    {
      name: "international",
      description: "Topics related to international students, exchange programs",
      examples: ["visa information", "exchange programs", "นักศึกษาต่างชาติ", "โครงการแลกเปลี่ยน"]
    },
    {
      name: "research",
      description: "Topics related to research opportunities, projects",
      examples: ["research projects", "publications", "การวิจัย", "โครงการวิจัย"]
    },
    {
      name: "faculty",
      description: "Topics related to professors, academic staff",
      examples: ["professor contact", "office hours", "อาจารย์", "บุคลากร"]
    },
    {
      name: "graduation",
      description: "Topics related to graduation requirements, ceremony",
      examples: ["graduation requirements", "commencement", "การสำเร็จการศึกษา", "พิธีรับปริญญา"]
    },
    {
      name: "other",
      description: "Other topics that don't fit in defined categories",
      examples: ["miscellaneous", "other inquiries", "เรื่องทั่วไป"]
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
   * Classify both intent and topic of a user message
   */
  async classifyMessageWithTopics(message: string): Promise<ClassificationResult> {
    try {
      console.log('Starting combined intent and topic classification for message:', message);
      
      // Construct a prompt for combined classification
      const prompt = this.buildCombinedClassificationPrompt(message);
      console.log('Built combined classification prompt');
      
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 800,
          temperature: 0.1, // Very low temperature for deterministic responses
          system: "You are an expert classifier for a university chatbot. Analyze the user's message to determine both intent and topic. Output ONLY valid JSON with both intent and topic classifications.",
          messages: [
            {
              role: "user", 
              content: prompt
            }
          ]
        })
      });
      
      console.log(`Sending combined classification request to model: ${this.modelId}`);
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
      console.log('Raw model response for combined classification:', responseContent);
      
      // Parse the JSON response
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        let jsonStr = responseContent;
        if (responseContent.includes("```json")) {
          jsonStr = responseContent.split("```json")[1].split("```")[0].trim();
        } else if (responseContent.includes("```")) {
          jsonStr = responseContent.split("```")[1].split("```")[0].trim();
        }
        
        const result = JSON.parse(jsonStr) as ClassificationResult;
        console.log('Successfully parsed combined classification result:', JSON.stringify(result, null, 2));
        
        // Ensure we have at least one intent and one topic
        if (!result.intents || result.intents.length === 0) {
          result.intents = [{ name: "other", confidence: 1.0 }];
        }
        
        if (!result.topics || result.topics.length === 0) {
          result.topics = [{ name: "other", confidence: 1.0 }];
        }
        
        return result;
      } catch (parseError) {
        console.error("Error parsing combined classification response:", parseError);
        // Return default values if parsing fails
        return {
          intents: [{ name: "other", confidence: 1.0 }],
          topics: [{ name: "other", confidence: 1.0 }]
        };
      }
    } catch (error) {
      console.error("Error in combined classification:", error);
      return {
        intents: [{ name: "other", confidence: 1.0 }],
        topics: [{ name: "other", confidence: 1.0 }]
      };
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
   * Build a prompt for combined intent and topic classification
   */
  private buildCombinedClassificationPrompt(message: string): string {
    const intentDefinitions = this.intents.map(intent => 
      `${intent.name}: ${intent.description}\nExamples: ${intent.examples.join(", ")}`
    ).join("\n\n");
    
    const topicDefinitions = this.topics.map(topic => 
      `${topic.name}: ${topic.description}\nExamples: ${topic.examples.join(", ")}`
    ).join("\n\n");
    
    return `
Below are the categories to classify user messages for a university chatbot:

INTENT CATEGORIES (what the user wants to do):
${intentDefinitions}

TOPIC CATEGORIES (what subject area the message is about):
${topicDefinitions}

User message: "${message}"

Analyze the user message and determine BOTH:
1. The intent categories (what action or response the user is seeking)
2. The topic categories (what subject areas the message relates to)

Consider the context, keywords, and patterns in the message.

Respond with a JSON object containing:
1. An "intents" array with at least one and at most three intents, ordered by confidence (highest first)
2. A "topics" array with at least one and at most three topics, ordered by confidence (highest first)

Confidence scores within each array should sum to 1.0.

For the most likely intent, extract any relevant entities from the message.

Example response format:
{
  "intents": [
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
  ],
  "topics": [
    {
      "name": "topic_name",
      "confidence": 0.7,
      "subtopics": ["subtopic1", "subtopic2"]
    },
    {
      "name": "another_topic",
      "confidence": 0.3
    }
  ]
}

Ensure your response is valid JSON and follows the exact format above. DO NOT include any explanations or text outside of the JSON object.
    `;
  }
  
  /**
   * Parse an existing message to determine intent for analytics or specialized handling
   */
  async analyzeMessage(message: string): Promise<{
    intent: string;
    entities?: {[key: string]: any};
    confidence: number;
    topic?: string;
    topicConfidence?: number;
  }> {
    console.log('Analyzing message for intent and topic:', message);
    
    try {
      // Use the new combined classification
      const classification = await this.classifyMessageWithTopics(message);
      const topIntent = classification.intents[0];
      const topTopic = classification.topics[0];
      
      console.log('Analysis complete. Top intent:', topIntent.name, 'with confidence:', topIntent.confidence);
      console.log('Top topic:', topTopic.name, 'with confidence:', topTopic.confidence);
      
      return {
        intent: topIntent.name,
        entities: topIntent.entities,
        confidence: topIntent.confidence,
        topic: topTopic.name,
        topicConfidence: topTopic.confidence
      };
    } catch (error) {
      // Fallback to just intent classification if the combined one fails
      console.error('Error in combined classification, falling back to intent-only:', error);
      const intents = await this.classifyIntent(message);
      const topIntent = intents[0];
      
      return {
        intent: topIntent.name,
        entities: topIntent.entities,
        confidence: topIntent.confidence
      };
    }
  }

  /**
   * Classify intent and topic, and generate response in a single API call using tool calling
   */
  async classifyAndRespond(
    message: string, 
    systemPrompt: string = '',
    temperature: number = 0.7
  ): Promise<{
    intent: string;
    intentConfidence: number;
    topic: string;
    topicConfidence: number;
    entities?: {[key: string]: any};
    response: string;
  }> {
    try {
      console.log('Using tool calling for message classification and response:', message);

      // Default system prompt if not provided
      const defaultSystemPrompt = `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.
      
      Response Style 🎯:
      - Be concise, friendly and conversational
      - Always respond in the same language the user is using
      - Use appropriate emojis to make responses engaging
      - Never say "I don't know" or "I'm not sure"
      - Always provide answers using your knowledge and reasoning
      - Break down complex topics into clear steps
      - Use markdown formatting effectively
      
      Knowledge Approach 📚:
      - Provide helpful information about university topics
      - Can analyze images, read files, search web
      - Provide step-by-step solutions for issues
      - For MFU questions, provide helpful general information
      
      First, you'll analyze the user's message to determine intent and topic, then respond appropriately.`;

      // Use provided system prompt or default
      const prompt = systemPrompt || defaultSystemPrompt;
      
      const command = new InvokeModelCommand({
        modelId: this.modelId, // Claude 3.5 Sonnet
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 3000,
          temperature: temperature,
          system: prompt,
          messages: [
            { role: "user", content: message }
          ],
          tools: [
            {
              name: "classify_message",
              description: "Classifies the intent and topic of the user's message",
              input_schema: {
                type: "object",
                properties: {
                  intent: {
                    type: "string",
                    enum: ["greeting", "enrollment_inquiry", "schedule_inquiry", "course_inquiry", 
                          "facility_inquiry", "academic_help", "technical_help", "feedback", 
                          "gratitude", "farewell", "image_generation", "image_analysis", "other"],
                    description: "The primary intent of the user's message"
                  },
                  intent_confidence: {
                    type: "number",
                    description: "Confidence score for the intent classification (0.0-1.0)"
                  },
                  topic: {
                    type: "string",
                    enum: ["admission", "tuition", "academic_programs", "courses", "examinations", 
                          "registration", "academic_calendar", "campus_facilities", "student_services",
                          "housing", "technology", "extracurricular", "international", "research",
                          "faculty", "graduation", "other"],
                    description: "The primary topic of the user's message"
                  },
                  topic_confidence: {
                    type: "number",
                    description: "Confidence score for the topic classification (0.0-1.0)"
                  },
                  entities: {
                    type: "object",
                    description: "Any specific entities mentioned in the message (optional)"
                  }
                },
                required: ["intent", "intent_confidence", "topic", "topic_confidence"]
              }
            }
          ],
          tool_choice: { type: "auto" }
        })
      });
      
      console.log('Sending tool calling request to Claude');
      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error("Empty response body from Bedrock");
      }
      
      const responseText = new TextDecoder().decode(response.body);
      const parsedResponse = JSON.parse(responseText);
      
      if (!parsedResponse.content) {
        throw new Error("Unexpected response format from Bedrock");
      }
      
      // Process the response containing both classification and answer
      let classification = null;
      let responseContent = "";
      
      for (const item of parsedResponse.content) {
        if (item.type === 'tool_use') {
          const toolUse = item.tool_use;
          if (toolUse.name === 'classify_message') {
            classification = toolUse.input;
          }
        } else if (item.type === 'text') {
          responseContent += item.text;
        }
      }
      
      if (!classification) {
        console.warn("Classification tool was not used in the response, using default classification");
        // Default classification if tool wasn't used
        classification = {
          intent: "other",
          intent_confidence: 0.8,
          topic: "other",
          topic_confidence: 0.8
        };
      }
      
      console.log('Classification result:', JSON.stringify(classification, null, 2));
      console.log('Response text length:', responseContent.length);
      
      return {
        intent: classification.intent,
        intentConfidence: classification.intent_confidence,
        topic: classification.topic,
        topicConfidence: classification.topic_confidence,
        entities: classification.entities,
        response: responseContent
      };
    } catch (error) {
      console.error("Error in tool calling classification and response:", error);
      
      // If there's a ValidationException related to tool_choice, fallback to manual classification
      if (
        error && 
        typeof error === 'object' && 
        'name' in error && 
        error.name === 'ValidationException' && 
        'message' in error && 
        typeof error.message === 'string' && 
        error.message.includes('tool_choice')
      ) {
        console.log('Falling back to separate classification and response due to tool_choice error');
        try {
          // Manually classify the message
          const analysis = await this.analyzeMessage(message);
          
          // Then generate a response without tool calling
          const responseCommand = new InvokeModelCommand({
            modelId: this.modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
              anthropic_version: "bedrock-2023-05-31",
              max_tokens: 3000,
              temperature: temperature,
              system: `${systemPrompt}\n\nThe message has been classified as intent: ${analysis.intent} (confidence: ${analysis.confidence}) and topic: ${analysis.topic || 'other'} (confidence: ${analysis.topicConfidence || 0}).`,
              messages: [
                { role: "user", content: message }
              ]
            })
          });
          
          const responseResult = await this.client.send(responseCommand);
          const responseText = new TextDecoder().decode(responseResult.body);
          const parsedResponse = JSON.parse(responseText);
          
          if (!parsedResponse.content || !parsedResponse.content[0]) {
            throw new Error("Unexpected response format from Bedrock in fallback");
          }
          
          const responseContent = parsedResponse.content[0].text;
          
          return {
            intent: analysis.intent,
            intentConfidence: analysis.confidence,
            topic: analysis.topic || 'other',
            topicConfidence: analysis.topicConfidence || 0,
            entities: analysis.entities,
            response: responseContent
          };
        } catch (fallbackError) {
          console.error("Error in fallback processing:", fallbackError);
        }
      }
      
      // Return default values in case of error
      return {
        intent: "other",
        intentConfidence: 1.0,
        topic: "other",
        topicConfidence: 1.0,
        response: "I apologize, but I encountered an error processing your message. Could you please try again?"
      };
    }
  }
}

export const intentClassifierService = new IntentClassifierService(); 