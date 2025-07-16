from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from lib.mongodb import get_database
from models.agent import Agent, AgentTemplate, AgentTool, AgentToolType
from bson import ObjectId

class AgentService:
    def __init__(self):
        self._db = None
        self._agents_collection = None
        self._templates_collection = None
    
    @property
    def db(self):
        if self._db is None:
            self._db = get_database()
        return self._db
    
    @property
    def agents_collection(self):
        if self._agents_collection is None:
            self._agents_collection = self.db.agents
        return self._agents_collection
    
    @property
    def templates_collection(self):
        if self._templates_collection is None:
            self._templates_collection = self.db.agent_templates
        return self._templates_collection
    
    def get_default_templates(self):
        """Get default agent templates"""
        return [
            {
                "_id": "programming-assistant",
                "name": "Programming Assistant",
                "description": "Expert in programming languages, debugging, and code review",
                "category": "Development",
                "icon": "💻",
                "systemPrompt": "You are an expert programming assistant. Help users with coding questions, debugging, code review, and software development best practices. Provide clear, practical solutions with examples. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.",
                "recommendedTools": ["web_search", "calculator"],
                "recommendedCollections": ["programming-docs", "api-documentation"],
                "tags": ["programming", "coding", "development"]
            },
            {
                "_id": "academic-tutor",
                "name": "Academic Tutor",
                "description": "Specialized in academic subjects and research assistance",
                "category": "Education",
                "icon": "🎓",
                "systemPrompt": "You are an academic tutor. Provide clear explanations, help students understand complex concepts, and assist with research. Use evidence-based information and cite sources when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.",
                "recommendedTools": ["web_search"],
                "recommendedCollections": ["academic-papers", "textbooks", "research-data"],
                "tags": ["education", "academic", "research"]
            },
            {
                "_id": "writing-assistant",
                "name": "Writing Assistant",
                "description": "Professional writing and content creation support",
                "category": "Content",
                "icon": "✍️",
                "systemPrompt": "You are a professional writing assistant. Help users with content creation, editing, proofreading, and improving writing style. Provide constructive feedback and suggestions. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.",
                "recommendedTools": ["web_search"],
                "recommendedCollections": ["writing-guides", "style-manuals"],
                "tags": ["writing", "content", "editing"]
            }
        ]

    async def get_all_agents(self, user_id: Optional[str] = None) -> List[Agent]:
        """Get all agents, optionally filtered by user"""
        try:
            query = {}
            if user_id:
                query = {"$or": [
                    {"createdBy": user_id},
                    {"isPublic": True}
                ]}
            
            agents_data = await self.agents_collection.find(query).to_list(length=None)
            
            # Convert ObjectId to string
            for agent in agents_data:
                agent["id"] = str(agent.pop("_id", ""))
                
            return [Agent(**agent) for agent in agents_data]
        except Exception as e:
            print(f"Error fetching agents: {e}")
            return []

    async def get_agent_by_id(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID"""
        try:
            # Handle special case for default agent ID
            if agent_id == '000000000000000000000001':
                # Return a default agent
                return Agent(
                    id='000000000000000000000001',
                    name='General Assistant',
                    description='A helpful AI assistant for general questions and tasks',
                    systemPrompt='You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
                    modelId='anthropic.claude-3-5-sonnet-20240620-v1:0',
                    collectionNames=[],
                    tools=[],
                    temperature=0.7,
                    maxTokens=4000,
                    isPublic=True,
                    tags=['general', 'assistant'],
                    createdBy='system',
                    createdAt=datetime.utcnow(),
                    updatedAt=datetime.utcnow(),
                    usageCount=0,
                    rating=0.0
                )
            
            # Validate ObjectId format
            if not ObjectId.is_valid(agent_id):
                print(f"Invalid ObjectId format: {agent_id}")
                return None
                
            agent_data = await self.agents_collection.find_one({"_id": ObjectId(agent_id)})
            if agent_data:
                agent_data["id"] = str(agent_data.pop("_id"))
                return Agent(**agent_data)
            return None
        except Exception as e:
            print(f"Error fetching agent {agent_id}: {e}")
            return None

    async def create_agent(self, agent_data: Dict[str, Any]) -> Agent:
        """Create a new agent"""
        try:
            # Prepare agent document
            agent_doc = {
                "_id": ObjectId(),
                "name": agent_data["name"],
                "description": agent_data.get("description", ""),
                "systemPrompt": agent_data.get("systemPrompt", ""),
                "modelId": agent_data["modelId"],
                "collectionNames": agent_data.get("collectionNames", []),
                "tools": agent_data.get("tools", []),
                "temperature": agent_data.get("temperature", 0.7),
                "maxTokens": agent_data.get("maxTokens", 4000),
                "isPublic": agent_data.get("isPublic", False),
                "tags": agent_data.get("tags", []),
                "createdBy": agent_data["createdBy"],
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "usageCount": 0,
                "rating": 0.0
            }
            
            result = await self.agents_collection.insert_one(agent_doc)
            
            # Return created agent
            agent_doc["id"] = str(agent_doc.pop("_id"))
            return Agent(**agent_doc)
            
        except Exception as e:
            print(f"Error creating agent: {e}")
            raise ValueError(f"Failed to create agent: {str(e)}")

    async def update_agent(self, agent_id: str, updates: Dict[str, Any]) -> Optional[Agent]:
        """Update an existing agent"""
        try:
            updates["updatedAt"] = datetime.utcnow()
            
            result = await self.agents_collection.update_one(
                {"_id": ObjectId(agent_id)},
                {"$set": updates}
            )
            
            if result.matched_count > 0:
                return await self.get_agent_by_id(agent_id)
            
            return None
        except Exception as e:
            print(f"Error updating agent {agent_id}: {e}")
            return None

    async def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent"""
        try:
            result = await self.agents_collection.delete_one({"_id": ObjectId(agent_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting agent {agent_id}: {e}")
            return False

    async def get_agent_templates(self) -> List[AgentTemplate]:
        """Get all agent templates"""
        try:
            # Check if templates exist in database
            templates_data = await self.templates_collection.find().to_list(length=None)
            
            # If no templates in database, initialize with defaults
            if not templates_data:
                default_templates = self.get_default_templates()
                await self.templates_collection.insert_many(default_templates)
                templates_data = default_templates
            
            # Convert to AgentTemplate objects
            templates = []
            for template in templates_data:
                template["id"] = template.get("_id", template.get("id"))
                if "_id" in template:
                    del template["_id"]
                templates.append(AgentTemplate(**template))
            
            return templates
        except Exception as e:
            print(f"Error fetching templates: {e}")
            return []

    async def create_agent_from_template(self, template_id: str, customizations: Dict[str, Any]) -> Agent:
        """Create an agent from a template"""
        try:
            # Get template
            template_data = await self.templates_collection.find_one({"_id": template_id})
            if not template_data:
                # Try from default templates
                default_templates = self.get_default_templates()
                template_data = next((t for t in default_templates if t["_id"] == template_id), None)
                if not template_data:
                    raise ValueError("Template not found")
            
            # Create agent data from template
            agent_data = {
                "name": customizations.get("name", template_data["name"]),
                "description": customizations.get("description", template_data["description"]),
                "systemPrompt": customizations.get("systemPrompt", template_data["systemPrompt"]),
                "modelId": customizations.get("modelId", "anthropic.claude-3-5-sonnet-20240620-v1:0"),
                "collectionNames": customizations.get("collectionNames", template_data.get("recommendedCollections", [])),
                "tools": customizations.get("tools", self._create_tools_from_recommendations(template_data.get("recommendedTools", []))),
                "temperature": customizations.get("temperature", 0.7),
                "maxTokens": customizations.get("maxTokens", 4000),
                "isPublic": customizations.get("isPublic", False),
                "tags": customizations.get("tags", template_data.get("tags", [])),
                "createdBy": customizations["createdBy"]
            }
            
            return await self.create_agent(agent_data)
            
        except Exception as e:
            print(f"Error creating agent from template: {e}")
            raise ValueError(f"Failed to create agent from template: {str(e)}")

    def _create_tools_from_recommendations(self, recommended_tools: List[str]) -> List[Dict[str, Any]]:
        """Create tool objects from recommended tool names"""
        tools = []
        for tool_type in recommended_tools:
            tool = {
                "id": tool_type,
                "name": tool_type.replace('_', ' ').title(),
                "description": f"{tool_type} tool",
                "type": tool_type,
                "config": {},
                "enabled": True
            }
            tools.append(tool)
        return tools

    async def increment_usage_count(self, agent_id: str) -> None:
        """Increment the usage count for an agent"""
        try:
            await self.agents_collection.update_one(
                {"_id": ObjectId(agent_id)},
                {"$inc": {"usageCount": 1}}
            )
        except Exception as e:
            print(f"Error incrementing usage count for agent {agent_id}: {e}")

    async def update_agent_rating(self, agent_id: str, rating: float) -> None:
        """Update the rating for an agent"""
        try:
            await self.agents_collection.update_one(
                {"_id": ObjectId(agent_id)},
                {"$set": {"rating": rating, "updatedAt": datetime.utcnow()}}
            )
        except Exception as e:
            print(f"Error updating rating for agent {agent_id}: {e}")

# Create singleton instance
agent_service = AgentService() 