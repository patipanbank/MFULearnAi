"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = exports.AgentService = void 0;
const agent_1 = require("../models/agent");
class AgentService {
    constructor() {
        this.defaultTemplates = [
            {
                id: 'programming-assistant',
                name: 'Programming Assistant',
                description: 'Expert in programming languages, debugging, and code review',
                category: 'Development',
                icon: '💻',
                systemPrompt: 'You are an expert programming assistant. Help users with coding questions, debugging, code review, and software development best practices. Provide clear, practical solutions with examples. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
                recommendedTools: ['web_search', 'calculator'],
                recommendedCollections: ['programming-docs', 'api-documentation'],
                tags: ['programming', 'coding', 'development']
            },
            {
                id: 'academic-tutor',
                name: 'Academic Tutor',
                description: 'Specialized in academic subjects and research assistance',
                category: 'Education',
                icon: '🎓',
                systemPrompt: 'You are an academic tutor. Provide clear explanations, help students understand complex concepts, and assist with research. Use evidence-based information and cite sources when appropriate. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
                recommendedTools: ['web_search'],
                recommendedCollections: ['academic-papers', 'textbooks', 'research-data'],
                tags: ['education', 'academic', 'research']
            },
            {
                id: 'writing-assistant',
                name: 'Writing Assistant',
                description: 'Professional writing and content creation support',
                category: 'Content',
                icon: '✍️',
                systemPrompt: 'You are a professional writing assistant. Help users with content creation, editing, proofreading, and improving writing style. Provide constructive feedback and suggestions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
                recommendedTools: ['web_search'],
                recommendedCollections: ['writing-guides', 'style-manuals'],
                tags: ['writing', 'content', 'editing']
            }
        ];
        console.log('✅ Agent service initialized');
    }
    async getAllAgents(userId) {
        try {
            let query = {};
            if (userId) {
                query = {
                    $or: [
                        { createdBy: userId },
                        { isPublic: true }
                    ]
                };
            }
            const agents = await agent_1.AgentModel.find(query).sort({ createdAt: -1 });
            return agents;
        }
        catch (error) {
            console.error('❌ Error fetching agents:', error);
            return [];
        }
    }
    async getAgentById(agentId) {
        try {
            if (agentId === '000000000000000000000001') {
                const defaultAgent = new agent_1.AgentModel({
                    name: 'General Assistant',
                    description: 'A helpful AI assistant for general questions and tasks',
                    systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
                    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                    collectionNames: [],
                    tools: [],
                    temperature: 0.7,
                    maxTokens: 4000,
                    isPublic: true,
                    tags: ['general', 'assistant'],
                    createdBy: 'system',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    usageCount: 0,
                    rating: 0.0
                });
                return defaultAgent;
            }
            const agent = await agent_1.AgentModel.findById(agentId);
            return agent;
        }
        catch (error) {
            console.error(`❌ Error fetching agent ${agentId}:`, error);
            return null;
        }
    }
    async createAgent(agentData) {
        try {
            const agent = new agent_1.AgentModel({
                ...agentData,
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 0,
                rating: 0.0
            });
            await agent.save();
            console.log(`✅ Created agent: ${agent.name}`);
            return agent;
        }
        catch (error) {
            console.error('❌ Error creating agent:', error);
            throw new Error(`Failed to create agent: ${error}`);
        }
    }
    async updateAgent(agentId, updates) {
        try {
            const agent = await agent_1.AgentModel.findByIdAndUpdate(agentId, { ...updates, updatedAt: new Date() }, { new: true });
            if (agent) {
                console.log(`✅ Updated agent: ${agent.name}`);
            }
            return agent;
        }
        catch (error) {
            console.error(`❌ Error updating agent ${agentId}:`, error);
            return null;
        }
    }
    async deleteAgent(agentId) {
        try {
            const result = await agent_1.AgentModel.findByIdAndDelete(agentId);
            const success = !!result;
            if (success) {
                console.log(`🗑️ Deleted agent: ${agentId}`);
            }
            return success;
        }
        catch (error) {
            console.error(`❌ Error deleting agent ${agentId}:`, error);
            return false;
        }
    }
    async getAgentTemplates() {
        return this.defaultTemplates;
    }
    async createAgentFromTemplate(templateId, customizations) {
        const template = this.defaultTemplates.find(t => t.id === templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        const agentData = {
            name: customizations.name || template.name,
            description: customizations.description || template.description,
            systemPrompt: customizations.systemPrompt || template.systemPrompt,
            modelId: customizations.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            collectionNames: customizations.collectionNames || template.recommendedCollections,
            tools: customizations.tools || [],
            temperature: customizations.temperature || 0.7,
            maxTokens: customizations.maxTokens || 4000,
            isPublic: customizations.isPublic || false,
            tags: customizations.tags || template.tags,
            createdBy: customizations.createdBy || 'system'
        };
        return this.createAgent(agentData);
    }
    async incrementUsageCount(agentId) {
        try {
            await agent_1.AgentModel.findByIdAndUpdate(agentId, {
                $inc: { usageCount: 1 },
                updatedAt: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Error incrementing usage count for agent ${agentId}:`, error);
        }
    }
    async updateAgentRating(agentId, rating) {
        try {
            await agent_1.AgentModel.findByIdAndUpdate(agentId, {
                rating,
                updatedAt: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Error updating rating for agent ${agentId}:`, error);
        }
    }
    async getPopularAgents(limit = 10) {
        try {
            const agents = await agent_1.AgentModel.find({ isPublic: true })
                .sort({ usageCount: -1, rating: -1 })
                .limit(limit);
            return agents;
        }
        catch (error) {
            console.error('❌ Error fetching popular agents:', error);
            return [];
        }
    }
    async searchAgents(query, userId) {
        try {
            let filter = {
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } }
                ]
            };
            if (userId) {
                filter.$or = [
                    { createdBy: userId },
                    { isPublic: true }
                ];
            }
            const agents = await agent_1.AgentModel.find(filter);
            return agents;
        }
        catch (error) {
            console.error('❌ Error searching agents:', error);
            return [];
        }
    }
}
exports.AgentService = AgentService;
exports.agentService = new AgentService();
//# sourceMappingURL=agentService.js.map