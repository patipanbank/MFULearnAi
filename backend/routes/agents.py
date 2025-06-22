from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from services.agent_service import agent_service
from models.agent import Agent, AgentTemplate
from middleware.role_guard import role_guard, TokenPayload
from pydantic import BaseModel

router = APIRouter()

class CreateAgentRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    systemPrompt: Optional[str] = ""
    modelId: str
    collectionNames: Optional[List[str]] = []
    tools: Optional[List[dict]] = []
    temperature: Optional[float] = 0.7
    maxTokens: Optional[int] = 4000
    isPublic: Optional[bool] = False
    tags: Optional[List[str]] = []

class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    systemPrompt: Optional[str] = None
    modelId: Optional[str] = None
    collectionNames: Optional[List[str]] = None
    tools: Optional[List[dict]] = None
    temperature: Optional[float] = None
    maxTokens: Optional[int] = None
    isPublic: Optional[bool] = None
    tags: Optional[List[str]] = None

class CreateFromTemplateRequest(BaseModel):
    templateId: str
    name: Optional[str] = None
    description: Optional[str] = None
    systemPrompt: Optional[str] = None
    modelId: Optional[str] = None
    collectionNames: Optional[List[str]] = None
    tools: Optional[List[dict]] = None
    temperature: Optional[float] = None
    maxTokens: Optional[int] = None
    isPublic: Optional[bool] = None
    tags: Optional[List[str]] = None

@router.get("/", response_model=List[Agent])
async def get_all_agents(
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Get all agents accessible to the current user"""
    try:
        agents = await agent_service.get_all_agents(user_id=current_user.sub)
        return agents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates", response_model=List[AgentTemplate])
async def get_agent_templates():
    """Get all agent templates (public access)"""
    try:
        templates = await agent_service.get_agent_templates()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}", response_model=Agent)
async def get_agent_by_id(
    agent_id: str,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Get a specific agent by ID"""
    try:
        agent = await agent_service.get_agent_by_id(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Check if user has access to this agent
        if agent.createdBy != current_user.sub and not agent.isPublic:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return agent
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=Agent)
async def create_agent(
    agent_data: CreateAgentRequest,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Create a new agent"""
    try:
        agent_dict = agent_data.model_dump()
        agent_dict["createdBy"] = current_user.sub
        
        agent = await agent_service.create_agent(agent_dict)
        return agent
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/from-template", response_model=Agent)
async def create_agent_from_template(
    request: CreateFromTemplateRequest,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Create an agent from a template"""
    try:
        customizations = request.model_dump(exclude={"templateId"}, exclude_unset=True)
        customizations["createdBy"] = current_user.sub
        
        agent = await agent_service.create_agent_from_template(
            request.templateId, 
            customizations
        )
        return agent
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: str,
    updates: UpdateAgentRequest,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Update an existing agent"""
    try:
        # Check if agent exists and user has permission
        existing_agent = await agent_service.get_agent_by_id(agent_id)
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if existing_agent.createdBy != current_user.sub:
            raise HTTPException(status_code=403, detail="Access denied")
        
        update_dict = updates.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        updated_agent = await agent_service.update_agent(agent_id, update_dict)
        if not updated_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return updated_agent
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Delete an agent"""
    try:
        # Check if agent exists and user has permission
        existing_agent = await agent_service.get_agent_by_id(agent_id)
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if existing_agent.createdBy != current_user.sub:
            raise HTTPException(status_code=403, detail="Access denied")
        
        success = await agent_service.delete_agent(agent_id)
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {"message": "Agent deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{agent_id}/use")
async def use_agent(
    agent_id: str,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Increment usage count when agent is used"""
    try:
        # Check if agent exists and user has access
        agent = await agent_service.get_agent_by_id(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent.createdBy != current_user.sub and not agent.isPublic:
            raise HTTPException(status_code=403, detail="Access denied")
        
        await agent_service.increment_usage_count(agent_id)
        return {"message": "Usage count updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{agent_id}/rate")
async def rate_agent(
    agent_id: str,
    rating: float,
    current_user: TokenPayload = Depends(role_guard(["Students", "Staffs", "Admin", "SuperAdmin"]))
):
    """Rate an agent"""
    try:
        if rating < 0 or rating > 5:
            raise HTTPException(status_code=400, detail="Rating must be between 0 and 5")
        
        # Check if agent exists and user has access
        agent = await agent_service.get_agent_by_id(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent.createdBy != current_user.sub and not agent.isPublic:
            raise HTTPException(status_code=403, detail="Access denied")
        
        await agent_service.update_agent_rating(agent_id, rating)
        return {"message": "Rating updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 