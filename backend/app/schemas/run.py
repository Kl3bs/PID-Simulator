from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

class TimeSeriesPoint(BaseModel):
    time: float
    position: float
    setpoint: float
    error: float
    force: float
    u_p: Optional[float] = 0.0
    u_i: Optional[float] = 0.0
    u_d: Optional[float] = 0.0
    disturbance: float = 0.0

class RunReportRequest(BaseModel):
    run_id: Optional[Any] = Field(None, description="Identificador da execução/rodada.")
    username: Optional[str] = Field("Anônimo", description="Nome do usuário ou estudante.")
    level_name: str = Field("Carro na Pista 3D", description="Nome da fase/planta de controle.")
    rise_time: Optional[float] = Field(None, description="Tempo de subida em segundos.")
    overshoot: float = Field(0.0, description="Sobressinal percentual.")
    settling_time: Optional[float] = Field(None, description="Tempo de acomodação em segundos.")
    final_error: float = Field(0.0, description="Erro residual final em regime permanente.")
    iae: Optional[float] = Field(0.0, description="Integral do Erro Absoluto.")
    ise: Optional[float] = Field(0.0, description="Integral do Erro Quadrático.")
    itae: Optional[float] = Field(0.0, description="Integral do Erro Ponderado pelo Tempo.")
    code_snippet: str = Field("", description="Código do controlador PID implementado.")
    time_series: List[TimeSeriesPoint] = Field(default_factory=list, description="Telemetria temporal da simulação.")
    prev_time_series: Optional[List[TimeSeriesPoint]] = Field(None, description="Telemetria da tentativa anterior para comparação.")
    created_at: Optional[datetime] = Field(None, description="Data/hora da simulação.")
    score: Optional[float] = Field(None, description="Pontuação opcional pré-calculada.")

# Alias para compatibilidade
RunCreate = RunReportRequest

class ScoreResponse(BaseModel):
    score: float
    level_name: str
    message: str = "Pontuação calculada com sucesso."
