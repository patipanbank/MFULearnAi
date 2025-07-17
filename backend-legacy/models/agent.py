from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class AgentToolType(str, Enum):
    FUNCTION = "function"
    RETRIEVER = "retriever"
    WEB_SEARCH = "web_search"
    CALCULATOR = "calculator"

class AgentTool(BaseModel):
    id: str
    name: str
    description: str
    type: AgentToolType
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

class AgentExecutionStatus(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    USING_TOOL = "using_tool"
    RESPONDING = "responding"
    ERROR = "error"

class TokenUsage(BaseModel):
    input: int = 0
    output: int = 0

class AgentExecution(BaseModel):
    id: str
    agentId: str
    sessionId: str
    status: AgentExecutionStatus = AgentExecutionStatus.IDLE
    currentTool: Optional[str] = None
    progress: int = 0
    startTime: datetime
    endTime: Optional[datetime] = None
    tokenUsage: TokenUsage = Field(default_factory=TokenUsage)

class Agent(BaseModel):
    id: str
    name: str
    description: str
    systemPrompt: str
    modelId: str
    collectionNames: List[str] = Field(default_factory=list)
    tools: List[AgentTool] = Field(default_factory=list)
    temperature: float = 0.7
    maxTokens: int = 4000
    isPublic: bool = False
    tags: List[str] = Field(default_factory=list)
    createdBy: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    usageCount: int = 0
    rating: float = 0.0

class AgentTemplate(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    systemPrompt: str
    recommendedTools: List[str] = Field(default_factory=list)
    recommendedCollections: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list) 