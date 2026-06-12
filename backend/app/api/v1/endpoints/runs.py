from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import io
import csv

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

    score = calculate_run_score(
        level_name=run_in.level_name,
        rise_time=run_in.rise_time,
        overshoot=run_in.overshoot,
        settling_time=run_in.settling_time,
        final_error=run_in.final_error
    )

    # Converte a série temporal de Pydantic para Dict/List
    time_series_data = [pt.model_dump() for pt in run_in.time_series]

    # Cria a execução no banco
    db_run = Run(
        user_id=user_id,
        level_name=run_in.level_name,
        rise_time=run_in.rise_time,
        overshoot=run_in.overshoot,
        settling_time=run_in.settling_time,
        final_error=run_in.final_error,
        iae=run_in.iae,
        ise=run_in.ise,
        itae=run_in.itae,
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

    # Identifica o nome do usuário associado e busca a tentativa anterior
    username = "Anônimo"
    prev_time_series = None
    if run.user:
        username = run.user.username
        prev_run = db.query(Run).filter(
            Run.user_id == run.user_id,
            Run.level_name == run.level_name,
            Run.id < run.id
        ).order_by(desc(Run.id)).first()
        if prev_run:
            prev_time_series = prev_run.time_series

    metrics = {
        "rise_time": run.rise_time,
        "overshoot": run.overshoot,
        "settling_time": run.settling_time,
        "final_error": run.final_error,
        "iae": run.iae,
        "ise": run.ise,
        "itae": run.itae
    }

    pdf_buf = generate_pdf_report(
        run_id=run.id,
        username=username,
        level_name=run.level_name,
        metrics=metrics,
        score=run.score,
        code_snippet=run.code_snippet,
        time_series=run.time_series,
        created_at=run.created_at,
        prev_time_series=prev_time_series
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

@router.get("/export")
def export_runs(
    username: Optional[str] = None,
    run_id: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    """
    Exporta o histórico de rodadas (runs) para o formato CSV.
    Se o username for fornecido, filtra as rodadas desse usuário.
    Se run_id for fornecido, exporta apenas essa rodada específica.
    """
    query = db.query(Run)
    if username:
        query = query.join(User).filter(User.username == username)
    if run_id:
        query = query.filter(Run.id == run_id)
    runs = query.order_by(desc(Run.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Run ID", "Username", "Fase", "Tempo de Subida (s)", "Overshoot (%)",
        "Tempo de Acomodacao (s)", "Erro Final", "Pontuacao", "Data",
        "Tempo (s)", "Posicao", "Setpoint", "Erro", "Forca", "Perturbacao"
    ])

    for r in runs:
        uname = r.user.username if r.user else "Anônimo"
        run_meta = [
            r.id,
            uname,
            r.level_name,
            r.rise_time if r.rise_time is not None else "",
            f"{r.overshoot:.2f}",
            r.settling_time if r.settling_time is not None else "",
            f"{r.final_error:.2f}",
            f"{r.score:.2f}",
            r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ]
        
        if not r.time_series:
            writer.writerow(run_meta + ["", "", "", "", ""])
            continue
            
        for pt in r.time_series:
            writer.writerow(run_meta + [
                f"{pt.get('time', 0.0):.3f}",
                f"{pt.get('position', 0.0):.3f}",
                f"{pt.get('setpoint', 0.0):.3f}",
                f"{pt.get('error', 0.0):.3f}",
                f"{pt.get('force', 0.0):.3f}",
                f"{pt.get('disturbance', 0.0):.3f}"
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=historico_runs.csv"}
    )

@router.get("/", response_model=List[schemas.RunResponse])
def get_runs(
    username: str,
    db: Session = Depends(deps.get_db)
):
    """
    Retorna o histórico de rodadas (runs) para um usuário específico.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return []
    
    runs = db.query(Run).filter(Run.user_id == user.id).order_by(desc(Run.created_at)).all()
    return runs

