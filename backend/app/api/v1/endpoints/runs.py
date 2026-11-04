from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import csv

from app.schemas import run as schemas
from app.services.score_service import calculate_run_score
from app.services.report_generator import generate_pdf_report

router = APIRouter()

@router.post("/report")
def generate_report(
    run_in: schemas.RunReportRequest
):
    """
    Gera o laudo técnico experimental em PDF diretamente a partir da telemetria e métricas
    enviadas pelo frontend, sem necessidade de banco de dados.
    Retorna o binário do PDF para download imediato.
    """
    # Determina o setpoint a partir da time_series (se disponível)
    setpoint_val = 600.0
    if run_in.time_series and len(run_in.time_series) > 0:
        setpoint_val = abs(run_in.time_series[0].setpoint) or 600.0

    score = run_in.score
    if score is None:
        score = calculate_run_score(
            level_name=run_in.level_name,
            rise_time=run_in.rise_time,
            overshoot=run_in.overshoot,
            settling_time=run_in.settling_time,
            final_error=run_in.final_error,
            setpoint=setpoint_val
        )

    metrics = {
        "rise_time": run_in.rise_time,
        "overshoot": run_in.overshoot,
        "settling_time": run_in.settling_time,
        "final_error": run_in.final_error,
        "iae": run_in.iae,
        "ise": run_in.ise,
        "itae": run_in.itae
    }

    time_series_data = [pt.model_dump() for pt in run_in.time_series]
    prev_time_series_data = (
        [pt.model_dump() for pt in run_in.prev_time_series]
        if run_in.prev_time_series else None
    )

    username = (run_in.username or "Anônimo").strip() or "Anônimo"
    created_at = run_in.created_at or datetime.now()

    pdf_buf = generate_pdf_report(
        run_id=run_in.run_id or 1,
        username=username,
        level_name=run_in.level_name,
        metrics=metrics,
        score=score,
        code_snippet=run_in.code_snippet,
        time_series=time_series_data,
        created_at=created_at,
        prev_time_series=prev_time_series_data
    )

    clean_level = run_in.level_name.replace(" ", "_").lower()
    run_id_part = f"run_{run_in.run_id}_" if run_in.run_id is not None else ""
    filename = f"relatorio_{run_id_part}{clean_level}.pdf"

    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Run-Score": str(score),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Run-Score"
        }
    )

@router.post("/export-csv")
def export_csv_stateless(
    run_in: schemas.RunReportRequest
):
    """
    Gera e exporta a série temporal enviada pelo frontend em formato CSV limpo.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "time_s", "position_y", "setpoint_r", "error_e", "force_u", "u_p", "u_i", "u_d", "disturbance"
    ])

    for pt in run_in.time_series:
        p_dict = pt.model_dump()
        writer.writerow([
            f"{p_dict.get('time', 0.0):.3f}",
            f"{p_dict.get('position', 0.0):.3f}",
            f"{p_dict.get('setpoint', 0.0):.3f}",
            f"{p_dict.get('error', 0.0):.3f}",
            f"{p_dict.get('force', 0.0):.3f}",
            f"{p_dict.get('u_p', 0.0):.3f}",
            f"{p_dict.get('u_i', 0.0):.3f}",
            f"{p_dict.get('u_d', 0.0):.3f}",
            f"{p_dict.get('disturbance', 0.0):.3f}"
        ])

    output.seek(0)
    run_id_part = f"_{run_in.run_id}" if run_in.run_id is not None else ""
    filename = f"telemetria_pid{run_id_part}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.post("/score", response_model=schemas.ScoreResponse)
def compute_score_only(
    run_in: schemas.RunReportRequest
):
    """
    Calcula a pontuação da rodada com base nas métricas sem gerar PDF.
    """
    setpoint_val = 600.0
    if run_in.time_series and len(run_in.time_series) > 0:
        setpoint_val = abs(run_in.time_series[0].setpoint) or 600.0

    score = calculate_run_score(
        level_name=run_in.level_name,
        rise_time=run_in.rise_time,
        overshoot=run_in.overshoot,
        settling_time=run_in.settling_time,
        final_error=run_in.final_error,
        setpoint=setpoint_val
    )

    return schemas.ScoreResponse(
        score=score,
        level_name=run_in.level_name
    )

# Rota POST / para suporte direto
@router.post("/")
def create_run_legacy_or_report(
    run_in: schemas.RunReportRequest
):
    """
    Endpoint principal para compatibilidade retroativa: calcula score e gera o PDF.
    """
    return generate_report(run_in)
