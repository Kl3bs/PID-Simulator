from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API Stateless para o Simulador PID e Geração de Relatórios (TCC)",
    version="1.0.0"
)

# Configuração de CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
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
        "modo": "stateless",
        "mensagem": f"API do {settings.PROJECT_NAME} ativa. Acesse {settings.API_V1_STR} para as rotas ou /docs para documentação.",
    }
