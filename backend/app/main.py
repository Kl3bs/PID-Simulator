from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings
from app.db.session import engine
from app.db.base_class import Base
from app.models.user import User
from app.models.run import Run

# Inicializa as tabelas do banco de dados automaticamente no startup
try:
    Base.metadata.create_all(bind=engine)
    print("Tabelas do banco de dados inicializadas com sucesso.")
except Exception as e:
    print(f"Erro ao inicializar tabelas do banco de dados: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API para o Simulador PID e Identificação de Sistemas (TCC)",
    version="1.0.0"
)

# Configuração de CORS (Permitir requisições do frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Ajuste para os domínios específicos em produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui as rotas da versão 1 da API
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "sucesso",
        "mensagem": f"API do {settings.PROJECT_NAME} ativa. Acesse {settings.API_V1_STR} para as rotas ou /docs para documentação.",
    }
