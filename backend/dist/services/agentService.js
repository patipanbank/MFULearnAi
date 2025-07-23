"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = exports.AgentService = void 0;
const agent_1 = require("../models/agent");
const uuid_1 = require("uuid");
class AgentService {
    constructor() {
        console.log('✅ Agent service initialized');
    }
    async getAllAgents(userId, query) {
        try {
            let mongoQuery = {};
            if (userId) {
                mongoQuery = {
                    $or: [
                        { createdBy: userId },
                        { isPublic: true }
                    ]
                };
            }
            if (query?.search) {
                const searchRegex = new RegExp(query.search, 'i');
                mongoQuery = {
                    ...mongoQuery,
                    $or: [
                        { name: searchRegex },
                        { description: searchRegex },
                        { tags: { $in: [searchRegex] } }
                    ]
                };
            }
            if (query?.tags) {
                const tags = query.tags.split(',').map((tag) => tag.trim());
                mongoQuery.tags = { $in: tags };
            }
            if (query?.isPublic !== undefined) {
                mongoQuery.isPublic = query.isPublic;
            }
            const limit = query?.limit || 50;
            const offset = query?.offset || 0;
            const agents = await agent_1.AgentModel.find(mongoQuery)
                .limit(limit)
                .skip(offset)
                .sort({ createdAt: -1 })
                .lean()
                .exec();
            return agents;
        }
        catch (error) {
            console.error('Error fetching agents:', error);
            return [];
        }
    }
    async getAgentById(agentId) {
        try {
            if (agentId === '000000000000000000000001') {
                return this.getDefaultAgent();
            }
            const agent = await agent_1.AgentModel.findById(agentId);
            return agent;
        }
        catch (error) {
            console.error(`Error fetching agent ${agentId}:`, error);
            return null;
        }
    }
    getDefaultAgent() {
        return new agent_1.AgentModel({
            name: 'General Assistant',
            description: 'A helpful AI assistant for general questions and tasks',
            systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            collectionNames: [],
            tools: [
                { id: (0, uuid_1.v4)(), name: 'Web Search', description: 'Search the web for current information', type: agent_1.AgentToolType.WEB_SEARCH, config: {}, enabled: true },
                { id: (0, uuid_1.v4)(), name: 'Calculator', description: 'Perform mathematical calculations', type: agent_1.AgentToolType.CALCULATOR, config: {}, enabled: true },
                { id: (0, uuid_1.v4)(), name: 'Current Date', description: 'Get the current date and time', type: agent_1.AgentToolType.CURRENT_DATE, config: {}, enabled: true },
                { id: (0, uuid_1.v4)(), name: 'Memory Search', description: 'Search through chat memory for relevant context', type: agent_1.AgentToolType.MEMORY_SEARCH, config: {}, enabled: true },
                { id: (0, uuid_1.v4)(), name: 'Memory Embed', description: 'Embed new message into chat memory', type: agent_1.AgentToolType.MEMORY_EMBED, config: {}, enabled: true }
            ],
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
    }
    async createAgent(agentData) {
        try {
            const agent = new agent_1.AgentModel({
                name: agentData.name,
                description: agentData.description || '',
                systemPrompt: agentData.systemPrompt || '',
                modelId: agentData.modelId,
                collectionNames: agentData.collectionNames || [],
                tools: agentData.tools || [],
                temperature: agentData.temperature || 0.7,
                maxTokens: agentData.maxTokens || 4000,
                isPublic: agentData.isPublic || false,
                tags: agentData.tags || [],
                createdBy: agentData.createdBy,
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
            console.error('Error creating agent:', error);
            throw new Error(`Failed to create agent: ${error}`);
        }
    }
    async updateAgent(agentId, updates) {
        try {
            updates.updatedAt = new Date();
            const agent = await agent_1.AgentModel.findByIdAndUpdate(agentId, { $set: updates }, { new: true });
            if (agent) {
                console.log(`✅ Updated agent: ${agent.name}`);
            }
            return agent;
        }
        catch (error) {
            console.error(`Error updating agent ${agentId}:`, error);
            return null;
        }
    }
    async deleteAgent(agentId) {
        try {
            const result = await agent_1.AgentModel.findByIdAndDelete(agentId);
            const success = !!result;
            if (success) {
                console.log(`🗑️ Deleted agent: ${result?.name}`);
            }
            return success;
        }
        catch (error) {
            console.error(`Error deleting agent ${agentId}:`, error);
            return false;
        }
    }
    async getAgentTemplates() {
        try {
            let templates = await agent_1.AgentTemplateModel.find().exec();
            if (templates.length === 0) {
                const defaultTemplates = this.getDefaultTemplates();
                await agent_1.AgentTemplateModel.insertMany(defaultTemplates);
                templates = await agent_1.AgentTemplateModel.find().exec();
            }
            return templates;
        }
        catch (error) {
            console.error('Error fetching agent templates:', error);
            return [];
        }
    }
    getDefaultTemplates() {
        return [
            {
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
    }
    async createAgentFromTemplate(templateId, customizations) {
        try {
            const template = await agent_1.AgentTemplateModel.findById(templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            const tools = this.createToolsFromRecommendations(template.recommendedTools);
            const agentData = {
                name: customizations.name || template.name,
                description: customizations.description || template.description,
                systemPrompt: customizations.systemPrompt || template.systemPrompt,
                modelId: customizations.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                collectionNames: customizations.collectionNames || template.recommendedCollections,
                tools,
                temperature: customizations.temperature || 0.7,
                maxTokens: customizations.maxTokens || 4000,
                isPublic: customizations.isPublic || false,
                tags: customizations.tags || template.tags,
                createdBy: customizations.createdBy
            };
            return await this.createAgent(agentData);
        }
        catch (error) {
            console.error('Error creating agent from template:', error);
            throw new Error(`Failed to create agent from template: ${error}`);
        }
    }
    createToolsFromRecommendations(recommendedTools) {
        const toolMap = {
            web_search: {
                id: (0, uuid_1.v4)(),
                name: 'Web Search',
                description: 'Search the web for current information',
                type: agent_1.AgentToolType.WEB_SEARCH,
                config: {},
                enabled: true
            },
            calculator: {
                id: (0, uuid_1.v4)(),
                name: 'Calculator',
                description: 'Perform mathematical calculations',
                type: agent_1.AgentToolType.CALCULATOR,
                config: {},
                enabled: true
            }
        };
        return recommendedTools
            .map(toolName => toolMap[toolName])
            .filter(tool => tool !== undefined);
    }
    async incrementUsageCount(agentId) {
        try {
            await agent_1.AgentModel.findByIdAndUpdate(agentId, { $inc: { usageCount: 1 } });
        }
        catch (error) {
            console.error(`Error incrementing usage count for agent ${agentId}:`, error);
        }
    }
    async updateAgentRating(agentId, rating) {
        try {
            await agent_1.AgentModel.findByIdAndUpdate(agentId, { $set: { rating } });
        }
        catch (error) {
            console.error(`Error updating rating for agent ${agentId}:`, error);
        }
    }
    async getPopularAgents(limit = 10) {
        try {
            const agents = await agent_1.AgentModel.find({ isPublic: true })
                .sort({ usageCount: -1, rating: -1 })
                .limit(limit)
                .exec();
            return agents;
        }
        catch (error) {
            console.error('Error fetching popular agents:', error);
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
            const agents = await agent_1.AgentModel.find(filter).exec();
            return agents;
        }
        catch (error) {
            console.error('Error searching agents:', error);
            return [];
        }
    }
}
exports.AgentService = AgentService;
exports.agentService = new AgentService();
//# sourceMappingURL=agentService.js.map