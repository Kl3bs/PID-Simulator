from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="TCC Backend API",
    description="API inicial para o projeto de TCC (Simulador PID / Identificação de Sistemas)",
    version="1.0.0"
)

# Configuração de CORS (Permitir que o frontend faça chamadas para a API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, substitua "*" pelos domínios reais do seu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """
    Endpoint de Hello World para testar a saúde da API.
    """
    return {
        "status": "sucesso",
        "mensagem": "Hello World! A API do TCC está rodando corretamente.",
    }

# Para rodar a aplicação via linha de comando, use:
# uvicorn app.main:app --reload
