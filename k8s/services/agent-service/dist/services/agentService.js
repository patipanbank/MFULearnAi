"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = exports.AgentService = void 0;
const agent_1 = require("../models/agent");
const user_1 = require("../models/user");
const uuid_1 = require("uuid");
const unifiedToolRegistry_1 = require("./unifiedToolRegistry");
function normalizeAgent(agent) {
    // ถ้า agent เป็น Mongoose Document ให้แปลงเป็น plain object ก่อน
    const obj = (typeof agent.toObject === 'function') ? agent.toObject() : agent;
    // Handle backward compatibility for permission
    let permission = obj.permission || agent_1.AgentPermission.PRIVATE;
    if (obj.isPublic && !obj.permission) {
        permission = agent_1.AgentPermission.PUBLIC;
    }
    return {
        id: obj.id || obj._id?.toString() || '',
        name: typeof obj.name === 'string' ? obj.name : '',
        description: typeof obj.description === 'string' ? obj.description : '',
        systemPrompt: typeof obj.systemPrompt === 'string' ? obj.systemPrompt : '',
        modelId: typeof obj.modelId === 'string' ? obj.modelId : '',
        collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames : [],
        tools: Array.isArray(obj.tools) ? obj.tools : [],
        temperature: typeof obj.temperature === 'number' ? obj.temperature : 0.7,
        maxTokens: typeof obj.maxTokens === 'number' ? obj.maxTokens : 4000,
        permission: permission,
        department: typeof obj.department === 'string' ? obj.department : undefined,
        isPublic: typeof obj.isPublic === 'boolean' ? obj.isPublic : (permission === agent_1.AgentPermission.PUBLIC),
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        createdBy: typeof obj.createdBy === 'string' ? obj.createdBy : '',
        createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
        updatedAt: obj.updatedAt ? new Date(obj.updatedAt) : new Date(),
        usageCount: typeof obj.usageCount === 'number' ? obj.usageCount : 0,
        rating: typeof obj.rating === 'number' ? obj.rating : 0.0,
    };
}
class AgentService {
    constructor() {
        console.log('✅ Agent service initialized');
    }
    // Check if user can create agent with specific permission
    canUserCreateAgent(user, permission) {
        if (!user)
            return false;
        switch (permission) {
            case agent_1.AgentPermission.PRIVATE:
                // All users can create private agents
                return true;
            case agent_1.AgentPermission.DEPARTMENT:
                // STAFF, ADMIN, SUPER_ADMIN can create department agents
                return user.role === user_1.UserRole.STAFFS || user.role === user_1.UserRole.ADMIN || user.role === user_1.UserRole.SUPER_ADMIN;
            case agent_1.AgentPermission.PUBLIC:
                // Only ADMIN and SUPER_ADMIN can create public agents
                return user.role === user_1.UserRole.ADMIN || user.role === user_1.UserRole.SUPER_ADMIN;
            default:
                return false;
        }
    }
    // Check if user can access agent
    canUserAccessAgent(user, agent) {
        if (!agent)
            return false;
        // Public agents can be accessed by anyone
        if (agent.permission === agent_1.AgentPermission.PUBLIC || agent.isPublic) {
            return true;
        }
        // Private agents can only be accessed by creator
        if (agent.permission === agent_1.AgentPermission.PRIVATE) {
            return agent.createdBy === user.username;
        }
        // Department agents can be accessed by same department users
        if (agent.permission === agent_1.AgentPermission.DEPARTMENT) {
            return (agent.createdBy === user.username ||
                user.department === agent.department);
        }
        return false;
    }
    // Check if user can modify agent
    canUserModifyAgent(user, agent) {
        if (!agent || !user) {
            return false;
        }
        // Users can modify their own agents
        if (agent.createdBy === user.username) {
            return true;
        }
        // No one else can modify agents (even admins can't modify others' agents per requirement)
        return false;
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
            const agents = await agent_1.AgentModel.find(query).lean().exec();
            return agents.map(normalizeAgent);
        }
        catch (error) {
            console.error('Error fetching agents:', error);
            return [];
        }
    }
    async getAgentById(agentId) {
        try {
            if (agentId === '000000000000000000000001') {
                return normalizeAgent(this.getDefaultAgent());
            }
            const agent = await agent_1.AgentModel.findById(agentId).lean();
            return agent ? normalizeAgent(agent) : null;
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
    async createAgent(agentData, user) {
        try {
            // Determine permission - use new permission field or fallback to isPublic
            const permission = agentData.permission ||
                (agentData.isPublic ? agent_1.AgentPermission.PUBLIC : agent_1.AgentPermission.PRIVATE);
            // Check if user can create agent with this permission
            if (user && !this.canUserCreateAgent(user, permission)) {
                throw new Error(`You don't have permission to create ${permission} agents`);
            }
            // Department agents must be created with user's department
            if (permission === agent_1.AgentPermission.DEPARTMENT && user && !user.department) {
                throw new Error('User must have a department to create department agents');
            }
            // Validation ชื่อ agent
            if (!agentData.name || typeof agentData.name !== 'string' || !agentData.name.trim()) {
                throw new Error('Agent name cannot be empty');
            }
            const name = agentData.name.trim();
            if (name.length < 3) {
                throw new Error('Agent name must be at least 3 characters long');
            }
            if (name.length > 100) {
                throw new Error('Agent name cannot exceed 100 characters');
            }
            if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
                throw new Error('Agent name can only contain letters, numbers, spaces, hyphens, and underscores');
            }
            // Check if agent name already exists (case-insensitive)
            const existingAgent = await agent_1.AgentModel.findOne({ name: { $regex: `^${name}$`, $options: 'i' } }).exec();
            if (existingAgent) {
                throw new Error('Agent name already exists');
            }
            const agentDoc = {
                name: agentData.name,
                description: agentData.description ?? '',
                systemPrompt: agentData.systemPrompt ?? '',
                modelId: agentData.modelId ?? '',
                collectionNames: agentData.collectionNames ?? [],
                tools: agentData.tools ?? [],
                temperature: agentData.temperature ?? 0.7,
                maxTokens: agentData.maxTokens ?? 4000,
                permission: permission,
                isPublic: permission === agent_1.AgentPermission.PUBLIC, // Maintain backward compatibility
                tags: agentData.tags ?? [],
                createdBy: agentData.createdBy ?? (user ? user.username : ''),
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 0,
                rating: 0.0
            };
            // Set department for department agents
            if (permission === agent_1.AgentPermission.DEPARTMENT && user) {
                agentDoc.department = user.department;
            }
            const agent = new agent_1.AgentModel(agentDoc);
            await agent.save();
            console.log(`✅ Created agent: ${agent.name}`);
            return normalizeAgent(agent.toObject());
        }
        catch (error) {
            console.error('Error creating agent:', error);
            throw new Error(`Failed to create agent: ${error}`);
        }
    }
    async updateAgent(agentId, updates, userId) {
        try {
            // Check ownership if userId provided
            if (userId) {
                const existingAgent = await agent_1.AgentModel.findById(agentId);
                if (!existingAgent) {
                    throw new Error('Agent not found');
                }
                // ดึง user object
                const userService = require('./userService');
                const user = await userService.userService.get_user_by_id(userId);
                if (!user) {
                    throw new Error('User not found');
                }
                // Use new permission check - only creator can modify
                if (!this.canUserModifyAgent(user, existingAgent)) {
                    throw new Error('You can only update your own agents');
                }
            }
            // Validation ชื่อ agent
            if (updates.name) {
                const name = updates.name.trim();
                if (!name) {
                    throw new Error('Agent name cannot be empty');
                }
                if (name.length < 3) {
                    throw new Error('Agent name must be at least 3 characters long');
                }
                if (name.length > 100) {
                    throw new Error('Agent name cannot exceed 100 characters');
                }
                if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
                    throw new Error('Agent name can only contain letters, numbers, spaces, hyphens, and underscores');
                }
                // Check if new name conflicts with existing agent (case-insensitive)
                const existingAgent = await agent_1.AgentModel.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, _id: { $ne: agentId } }).exec();
                if (existingAgent) {
                    throw new Error('Agent name already exists');
                }
            }
            updates.updatedAt = new Date();
            const agent = await agent_1.AgentModel.findByIdAndUpdate(agentId, { $set: updates }, { new: true }).lean();
            if (agent) {
                console.log(`✅ Updated agent: ${agent.name}`);
            }
            return agent ? normalizeAgent(agent) : null;
        }
        catch (error) {
            console.error(`Error updating agent ${agentId}:`, error);
            return null;
        }
    }
    async deleteAgent(agentId, userId) {
        try {
            // Check ownership if userId provided
            if (userId) {
                const existingAgent = await agent_1.AgentModel.findById(agentId);
                if (!existingAgent) {
                    throw new Error('Agent not found');
                }
                // ดึง user object
                const userService = require('./userService');
                const user = await userService.userService.get_user_by_id(userId);
                if (!user) {
                    throw new Error('User not found');
                }
                // Use new permission check - only creator can delete
                if (!this.canUserModifyAgent(user, existingAgent)) {
                    throw new Error('You can only delete your own agents');
                }
            }
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
            // Check if templates exist in database
            let templates = await agent_1.AgentTemplateModel.find().exec();
            // If no templates in database, initialize with defaults
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
            const template = await agent_1.AgentTemplateModel.findById(templateId).lean();
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
            const agent = await this.createAgent(agentData);
            return normalizeAgent(agent);
        }
        catch (error) {
            console.error('Error creating agent from template:', error);
            throw new Error(`Failed to create agent from template: ${error}`);
        }
    }
    createToolsFromRecommendations(recommendedTools) {
        // Get tools from unified registry to ensure consistency
        const availableUnifiedTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools({});
        const toolMap = {
            web_search: {
                id: (0, uuid_1.v4)(),
                name: 'Web Search',
                description: 'Search the web for current information using Google Search API or DuckDuckGo fallback',
                type: agent_1.AgentToolType.WEB_SEARCH,
                config: { providers: ['google', 'duckduckgo'], timeout: 7000 },
                enabled: true
            },
            calculator: {
                id: (0, uuid_1.v4)(),
                name: 'Calculator',
                description: 'Perform mathematical calculations and expressions safely',
                type: agent_1.AgentToolType.CALCULATOR,
                config: { allowedOperations: ['+', '-', '*', '/', '(', ')', '.'] },
                enabled: true
            },
            current_date: {
                id: (0, uuid_1.v4)(),
                name: 'Current Date',
                description: 'Get current date and time with timezone support',
                type: agent_1.AgentToolType.CURRENT_DATE,
                config: { defaultTimezone: 'Asia/Bangkok' },
                enabled: true
            },
            memory_search: {
                id: (0, uuid_1.v4)(),
                name: 'Memory Search',
                description: 'Search through chat memory for relevant context',
                type: agent_1.AgentToolType.MEMORY_SEARCH,
                config: {},
                enabled: true
            },
            memory_embed: {
                id: (0, uuid_1.v4)(),
                name: 'Memory Embed',
                description: 'Embed new information into chat memory',
                type: agent_1.AgentToolType.MEMORY_EMBED,
                config: {},
                enabled: true
            }
        };
        return recommendedTools
            .map(toolName => toolMap[toolName])
            .filter(tool => tool !== undefined);
    }
    /**
     * Get available tools for frontend
     */
    getAvailableTools() {
        const unifiedTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools({});
        return unifiedTools.map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            type: this.mapUnifiedTypeToAgentType(tool.category),
            enabled: tool.enabled,
            version: tool.version,
            config: tool.config,
            tags: tool.metadata.tags,
            examples: tool.metadata.examples
        }));
    }
    /**
     * Map unified tool categories to agent tool types
     */
    mapUnifiedTypeToAgentType(category) {
        const mapping = {
            [unifiedToolRegistry_1.ToolCategory.SEARCH]: agent_1.AgentToolType.WEB_SEARCH,
            [unifiedToolRegistry_1.ToolCategory.CALCULATION]: agent_1.AgentToolType.CALCULATOR,
            [unifiedToolRegistry_1.ToolCategory.UTILITY]: agent_1.AgentToolType.CURRENT_DATE,
            [unifiedToolRegistry_1.ToolCategory.MEMORY]: agent_1.AgentToolType.MEMORY_SEARCH,
            [unifiedToolRegistry_1.ToolCategory.RETRIEVAL]: agent_1.AgentToolType.RETRIEVER,
            [unifiedToolRegistry_1.ToolCategory.CORE]: agent_1.AgentToolType.FUNCTION,
            [unifiedToolRegistry_1.ToolCategory.INTEGRATION]: agent_1.AgentToolType.FUNCTION,
            [unifiedToolRegistry_1.ToolCategory.CUSTOM]: agent_1.AgentToolType.FUNCTION
        };
        return mapping[category] || agent_1.AgentToolType.FUNCTION;
    }
    /**
     * Get tool statistics for admin dashboard
     */
    getToolStatistics() {
        return unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics();
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
                .lean()
                .exec();
            return agents.map(normalizeAgent);
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
            const agents = await agent_1.AgentModel.find(filter).lean().exec();
            return agents.map(normalizeAgent);
        }
        catch (error) {
            console.error('Error searching agents:', error);
            return [];
        }
    }
}
exports.AgentService = AgentService;
// Export singleton instance
exports.agentService = new AgentService();
//# sourceMappingURL=agentService.js.map