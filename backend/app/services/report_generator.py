import io
import matplotlib
matplotlib.use("Agg") # Evita problemas com backend de interface em ambientes headless/Docker
import matplotlib.pyplot as plt
from datetime import datetime
from typing import List, Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from app.services.score_service import generate_diagnosis

def generate_chart(time_series: List[Dict[str, Any]]) -> io.BytesIO:
    """
    Gera o gráfico da simulação usando matplotlib e retorna em um buffer de memória (BytesIO).
    """
    times = [p["time"] for p in time_series]
    positions = [p["position"] for p in time_series]
    setpoints = [p["setpoint"] for p in time_series]
    errors = [p["error"] for p in time_series]
    forces = [p["force"] for p in time_series]
    disturbances = [p.get("disturbance", 0.0) for p in time_series]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 6), sharex=True)
    fig.patch.set_facecolor('#FCFCFD')

    # Gráfico Superior: Posição, Setpoint e Erro
    ax1.set_facecolor('#FAFAFB')
    ax1.plot(times, positions, label="Posição", color="#04A777", linewidth=2)
    ax1.plot(times, setpoints, label="Meta (Setpoint)", color="#1A1A2E", linestyle="--", linewidth=1.5)
    ax1.plot(times, errors, label="Erro", color="#FFB703", linewidth=1, alpha=0.8)
    ax1.set_ylabel("Posição / Erro (m)")
    ax1.grid(True, linestyle=":", alpha=0.6, color="#CCCCCC")
    ax1.legend(loc="upper right", framealpha=0.9, facecolor='#FFFFFF')
    ax1.set_title("Comportamento do Sistema PID", fontsize=12, color="#0D3B59", fontweight="bold")

    # Gráfico Inferior: Ação de Controle (Força) e Perturbações
    ax2.set_facecolor('#FAFAFB')
    ax2.plot(times, forces, label="Força de Controle (U)", color="#FF6B35", linewidth=1.5)
    if any(d != 0.0 for d in disturbances):
        ax2.plot(times, disturbances, label="Perturbação Externa", color="#D90429", linewidth=1.2, alpha=0.8)
    ax2.set_ylabel("Força (N)")
    ax2.set_xlabel("Tempo (s)")
    ax2.grid(True, linestyle=":", alpha=0.6, color="#CCCCCC")
    ax2.legend(loc="upper right", framealpha=0.9, facecolor='#FFFFFF')

    plt.tight_layout()
    
    img_buf = io.BytesIO()
    plt.savefig(img_buf, format="png", dpi=150, facecolor=fig.get_facecolor())
    img_buf.seek(0)
    plt.close(fig)
    return img_buf

def generate_pdf_report(
    run_id: int,
    username: str,
    level_name: str,
    metrics: Dict[str, Any],
    score: float,
    code_snippet: str,
    time_series: List[Dict[str, Any]],
    created_at: datetime
) -> io.BytesIO:
    """
    Gera o relatório profissional em formato PDF e retorna os bytes em um buffer de memória.
    """
    pdf_buf = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buf,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Estilos customizados de tipografia
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0D3B59'),
        spaceAfter=15
    )
    
    section_style = ParagraphStyle(
        'DocSection',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1A6E8A'),
        spaceBefore=15,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8
    )

    code_style = ParagraphStyle(
        'DocCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#222222'),
    )

    score_style = ParagraphStyle(
        'DocScore',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#04A777') if score >= 70 else colors.HexColor('#D90429')
    )

    elements = []

    # 1. Cabeçalho / Título do Relatório
    elements.append(Paragraph("Relatório de Controle PID", title_style))
    elements.append(Paragraph("Simulador de Sistemas de Controle Dinâmico - TCC", body_style))
    elements.append(Spacer(1, 10))

    # 2. Informações Gerais da Execução (Tabela de Metadados)
    formatted_date = created_at.strftime("%d/%m/%Y às %H:%M:%S")
    meta_data = [
        [
            Paragraph("<b>Identificador da Run:</b>", body_style), Paragraph(f"#{run_id}", body_style),
            Paragraph("<b>Data/Hora:</b>", body_style), Paragraph(formatted_date, body_style)
        ],
        [
            Paragraph("<b>Estudante:</b>", body_style), Paragraph(username, body_style),
            Paragraph("<b>Fase / Cenário:</b>", body_style), Paragraph(level_name, body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[120, 150, 100, 160])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F4F7F9')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,-1), (-1,-1), 1.5, colors.HexColor('#1A6E8A')),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 15))

    # 3. Métricas de Desempenho
    elements.append(Paragraph("Métricas de Desempenho e Controle", section_style))
    
    rise_val = f"{metrics.get('rise_time'):.2f}s" if metrics.get('rise_time') else "Não atingiu"
    settle_val = f"{metrics.get('settling_time'):.2f}s" if metrics.get('settling_time') else "Não estabilizou"
    overshoot_val = f"{metrics.get('overshoot'):.1f}%"
    err_val = f"{abs(metrics.get('final_error')):.2f} m"

    metrics_data = [
        ["Tempo de Subida", "Overshoot", "Tempo de Acomodação", "Erro Final", "Pontuação Final"],
        [rise_val, overshoot_val, settle_val, err_val, Paragraph(f"{score:.1f} / 100", score_style)]
    ]
    
    metrics_table = Table(metrics_data, colWidths=[120, 120, 120, 70, 100])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0D3B59')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 8),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#FAFAFB')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 15))

    # Diagnóstico Automático
    elements.append(Paragraph("Diagnóstico Pedagógico do Controlador", section_style))
    diagnosis_text = generate_diagnosis(metrics, score)
    
    diagnosis_table = Table([[Paragraph(diagnosis_text, body_style)]], colWidths=[530])
    diagnosis_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F4F7F9')),
        ('PADDING', (0,0), (-1,-1), 12),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#1A6E8A')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(diagnosis_table)
    elements.append(Spacer(1, 15))

    # 4. Gráfico de Resposta Temporal (Gerado com matplotlib)
    elements.append(Paragraph("Gráficos de Comportamento Dinâmico", section_style))
    chart_buf = generate_chart(time_series)
    chart_image = Image(chart_buf, width=480, height=360)
    chart_image.hAlign = 'CENTER'
    elements.append(chart_image)
    elements.append(Spacer(1, 15))

    # 5. Código do Algoritmo PID do Usuário (KeepTogether para evitar quebra de página)
    code_elements = [
        Paragraph("Algoritmo de Controle Implementado", section_style),
        Paragraph("Trecho de código JavaScript executado na malha de feedback da simulação:", body_style),
        Spacer(1, 4)
    ]
    
    # Formata as linhas de código
    escaped_code = code_snippet.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    code_para = Paragraph(escaped_code, code_style)
    
    code_table = Table([[code_para]], colWidths=[530])
    code_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('PADDING', (0,0), (-1,-1), 10),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
    ]))
    code_elements.append(code_table)
    
    elements.append(KeepTogether(code_elements))

    doc.build(elements)
    pdf_buf.seek(0)
    return pdf_buf
