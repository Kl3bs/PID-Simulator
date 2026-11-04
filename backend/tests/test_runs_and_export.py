import pytest
from fastapi.testclient import TestClient

from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_stateless_pdf_and_csv_generation(client):
    payload = {
        "run_id": 1,
        "username": "AlunoTCC",
        "level_name": "Carro na Pista 3D",
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

    # 1. Testa cálculo de pontuação (score)
    score_resp = client.post("/api/v1/runs/score", json=payload)
    assert score_resp.status_code == 200
    score_data = score_resp.json()
    assert "score" in score_data
    assert score_data["score"] > 0

    # 2. Testa geração do Relatório PDF Stateless
    pdf_resp = client.post("/api/v1/runs/report", json=payload)
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert "X-Run-Score" in pdf_resp.headers
    assert len(pdf_resp.content) > 1000  # PDF binário válido

    # 3. Testa exportação Stateless de CSV
    csv_resp = client.post("/api/v1/runs/export-csv", json=payload)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    csv_text = csv_resp.text
    assert "time_s,position_y,setpoint_r,error_e,force_u,u_p,u_i,u_d,disturbance" in csv_text
    assert "720.000" in csv_text

    # 4. Testa rota raiz da API
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    assert root_resp.json()["status"] == "sucesso"
