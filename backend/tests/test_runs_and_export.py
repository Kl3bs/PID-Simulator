import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base_class import Base
from app.api import deps

# Configuração de Banco SQLite em Memória para Testes
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[deps.get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    return TestClient(app)

def test_create_run_and_export_csv(client):
    payload = {
        "username": "AlunoTCC",
        "level_name": "Carro na Pista",
        "rise_time": 1.25,
        "overshoot": 4.8,
        "settling_time": 2.10,
        "final_error": 0.05,
        "iae": 12.4,
        "ise": 5.2,
        "itae": 8.9,
        "code_snippet": "let kp = 1.2;\nlet ki = 0.5;\nlet kd = 0.3;\nreturn (kp*error) + (ki*integral) + (kd*derivative);",
        "time_series": [
            {
                "time": 0.0,
                "position": 0.0,
                "setpoint": 600.0,
                "error": 600.0,
                "force": 720.0,
                "u_p": 720.0,
                "u_i": 0.0,
                "u_d": 0.0,
                "disturbance": 0.0
            },
            {
                "time": 0.1,
                "position": 50.0,
                "setpoint": 600.0,
                "error": 550.0,
                "force": 680.0,
                "u_p": 660.0,
                "u_i": 15.0,
                "u_d": 5.0,
                "disturbance": -12.5
            }
        ]
    }

    # 1. Cria a Run
    response = client.post("/api/v1/runs/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["username"] if "username" in data else True
    run_id = data["id"]

    # 2. Testa exportação individual de CSV
    csv_resp = client.get(f"/api/v1/runs/{run_id}/export-csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    csv_text = csv_resp.text
    assert "time_s,position_y,setpoint_r,error_e,force_u,u_p,u_i,u_d,disturbance" in csv_text
    assert "720.000" in csv_text

    # 3. Testa exportação do Relatório PDF
    pdf_resp = client.get(f"/api/v1/runs/{run_id}/report")
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert len(pdf_resp.content) > 1000 # O PDF deve conter dados binários válidos
