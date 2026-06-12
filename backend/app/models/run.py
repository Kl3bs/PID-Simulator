from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Run(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True) # nullable para permitir simulações sem login
    level_name = Column(String, index=True, nullable=False)
    
    # Métricas
    rise_time = Column(Float, nullable=True)
    overshoot = Column(Float, nullable=False)
    settling_time = Column(Float, nullable=True)
    final_error = Column(Float, nullable=False)
    iae = Column(Float, nullable=True)
    ise = Column(Float, nullable=True)
    itae = Column(Float, nullable=True)
    
    # Desempenho
    score = Column(Float, nullable=False)
    
    # Código e Telemetria
    code_snippet = Column(Text, nullable=False)
    time_series = Column(JSON, nullable=False) # Armazena a série temporal completa em JSON
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="runs")
