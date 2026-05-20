from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from app.api import deps
from app.models.run import Run
from app.models.user import User
from app.schemas import run as schemas
from app.services.score_service import calculate_run_score
from app.services.report_generator import generate_pdf_report

router = APIRouter()

@router.post("/", response_model=schemas.RunResponse, status_code=status.HTTP_201_CREATED)
def create_run(
    *,
    db: Session = Depends(deps.get_db),
    run_in: schemas.RunCreate
):
    """
    Registra uma nova rodada de simulação (run), calcula a pontuação (score) e persiste no banco.
    Se o username for fornecido, associa a execução a esse usuário (criando o usuário caso não exista).
    """
    user_id = None
    
    # 1. Trata a criação/associação do usuário se fornecido
    if run_in.username:
        username_clean = run_in.username.strip()
        if username_clean:
            user = db.query(User).filter(User.username == username_clean).first()
            if not user:
                user = User(username=username_clean)
                db.add(user)
                db.commit()
                db.refresh(user)
            user_id = user.id

    # 2. Calcula a pontuação da simulação
    score = calculate_run_score(
        level_name=run_in.level_name,
        rise_time=run_in.rise_time,
        overshoot=run_in.overshoot,
        settling_time=run_in.settling_time,
        final_error=run_in.final_error
    )

    # Convertendo a série temporal de Pydantic para Dict/List
    time_series_data = [pt.model_dump() for pt in run_in.time_series]

    # 3. Cria a execução no banco
    db_run = Run(
        user_id=user_id,
        level_name=run_in.level_name,
        rise_time=run_in.rise_time,
        overshoot=run_in.overshoot,
        settling_time=run_in.settling_time,
        final_error=run_in.final_error,
        score=score,
        code_snippet=run_in.code_snippet,
        time_series=time_series_data
    )
    
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    
    return db_run

@router.get("/{run_id}/report")
def get_run_report(
    run_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    Recupera os dados de uma simulação do banco e gera/baixa o relatório PDF correspondente.
    """
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulação (run) não encontrada."
        )

    # Identificar o nome do usuário associado
    username = "Anônimo"
    if run.user:
        username = run.user.username

    # Métricas formatadas para o gerador
    metrics = {
        "rise_time": run.rise_time,
        "overshoot": run.overshoot,
        "settling_time": run.settling_time,
        "final_error": run.final_error
    }

    # Gera os bytes do PDF
    pdf_buf = generate_pdf_report(
        run_id=run.id,
        username=username,
        level_name=run.level_name,
        metrics=metrics,
        score=run.score,
        code_snippet=run.code_snippet,
        time_series=run.time_series,
        created_at=run.created_at
    )

    filename = f"relatorio_run_{run.id}.pdf"
    
    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(
    level_name: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(deps.get_db)
):
    """
    Retorna os melhores resultados ordenados pela maior pontuação (Ranking).
    Pode filtrar opcionalmente por fase/nível de simulação.
    """
    query = db.query(Run).join(User, Run.user_id == User.id)
    
    if level_name:
        query = query.filter(Run.level_name == level_name)
        
    runs = query.order_by(desc(Run.score)).limit(limit).all()
    
    leaderboard = []
    for r in runs:
        leaderboard.append({
            "id": r.id,
            "username": r.user.username if r.user else "Anônimo",
            "level_name": r.level_name,
            "score": r.score,
            "created_at": r.created_at
        })
        
    return leaderboard
