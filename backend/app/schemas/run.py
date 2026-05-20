from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class TimeSeriesPoint(BaseModel):
    time: float
    position: float
    setpoint: float
    error: float
    force: float
    disturbance: float = 0.0

class RunCreate(BaseModel):
    username: Optional[str] = Field(None, description="Nome do usuário. Se não existir, será criado.")
    level_name: str
    rise_time: Optional[float] = None
    overshoot: float
    settling_time: Optional[float] = None
    final_error: float
    code_snippet: str
    time_series: List[TimeSeriesPoint]

class RunResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    level_name: str
    rise_time: Optional[float] = None
    overshoot: float
    settling_time: Optional[float] = None
    final_error: float
    score: float
    code_snippet: str
    time_series: List[TimeSeriesPoint]
    created_at: datetime

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    id: int
    username: str
    level_name: str
    score: float
    created_at: datetime

    class Config:
        from_attributes = True
