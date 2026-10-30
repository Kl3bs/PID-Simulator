import io
import matplotlib
matplotlib.use("Agg")  # Evita problemas com backend de interface gráfica em headless/Docker
import matplotlib.pyplot as plt
from datetime import datetime
from typing import List, Dict, Any, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def format_pt_br(val: Optional[float], decimals: int = 2) -> str:
    """
    Formata valores numéricos para o padrão brasileiro:
    separador de milhar por ponto e decimais por vírgula.
    """
    if val is None:
        return "--"
    try:
        formatted = f"{float(val):,.{decimals}f}"
        return formatted.replace(",", "X").replace(".", ",").replace("X", ".")
    except (ValueError, TypeError):
        return "--"

def generate_chart(time_series: List[Dict[str, Any]], prev_time_series: List[Dict[str, Any]] = None) -> io.BytesIO:
    """
    Gera o gráfico da simulação usando matplotlib e retorna em um buffer de memória (BytesIO).
    Se prev_time_series for fornecido, adiciona a tentativa anterior para comparação.
    Inclui a decomposição didática das ações P, I e D.
    """
    times = [p["time"] for p in time_series]
    positions = [p["position"] for p in time_series]
    setpoints = [p["setpoint"] for p in time_series]
    errors = [p["error"] for p in time_series]
    forces = [p["force"] for p in time_series]
    ups = [p.get("u_p", 0.0) for p in time_series]
    uis = [p.get("u_i", 0.0) for p in time_series]
    uds = [p.get("u_d", 0.0) for p in time_series]
    disturbances = [p.get("disturbance", 0.0) for p in time_series]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 5.2), sharex=True)
    fig.patch.set_facecolor('#FCFCFD')

    # Gráfico Superior: Posição, Setpoint e Erro
    ax1.set_facecolor('#FAFAFB')
    ax1.plot(times, positions, label="Posição y(t)", color="#00A896", linewidth=2)
    
    if prev_time_series:
        prev_times = [p["time"] for p in prev_time_series]
        prev_positions = [p["position"] for p in prev_time_series]
        ax1.plot(prev_times, prev_positions, label="Posição (Tentativa Anterior)", color="#94A3B8", linewidth=1.5, linestyle="-.", alpha=0.7)

    ax1.plot(times, setpoints, label="Meta r(t)", color="#D90429", linestyle="--", linewidth=1.5)
    ax1.plot(times, errors, label="Erro e(t)", color="#FFB703", linewidth=1, alpha=0.8)
    ax1.set_ylabel("Posição / Erro (m)")
    ax1.grid(True, linestyle=":", alpha=0.6, color="#CCCCCC")
    ax1.legend(loc="upper right", framealpha=0.9, facecolor='#FFFFFF', fontsize='small')
    ax1.set_title("Comportamento Dinâmico e Telemetria PID", fontsize=11, color="#0D3B59", fontweight="bold")

    # Gráfico Inferior: Decomposição das Ações de Controle (P, I, D) e Perturbações
    ax2.set_facecolor('#FAFAFB')
    ax2.plot(times, forces, label="Esforço Total u(t)", color="#0D3B59", linewidth=2)
    
    if any(u != 0.0 for u in ups):
        ax2.plot(times, ups, label="Ação P (u_p)", color="#FFB300", linewidth=1.2, linestyle=":")
    if any(u != 0.0 for u in uis):
        ax2.plot(times, uis, label="Ação I (u_i)", color="#00E676", linewidth=1.2, linestyle="--")
    if any(u != 0.0 for u in uds):
        ax2.plot(times, uds, label="Ação D (u_d)", color="#9C27B0", linewidth=1.2, linestyle="-.")
        
    if any(d != 0.0 for d in disturbances):
        ax2.plot(times, disturbances, label="Perturbação Externa", color="#EF4444", linewidth=1.2, alpha=0.8)
        
    ax2.set_ylabel("Força de Atuação (N)")
    ax2.set_xlabel("Tempo (s)")
    ax2.grid(True, linestyle=":", alpha=0.6, color="#CCCCCC")
    ax2.legend(loc="upper right", framealpha=0.9, facecolor='#FFFFFF', fontsize='small')

    plt.tight_layout()
    
    img_buf = io.BytesIO()
    plt.savefig(img_buf, format="png", dpi=150, facecolor=fig.get_facecolor())
    img_buf.seek(0)
    plt.close(fig)
    return img_buf

def make_page_canvas(run_id: int):
    """
    Retorna uma função de callback para desenhar o rodapé institucional em cada página.
    """
    def page_decorator(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#64748B"))
        
        # Linha divisória sutil do rodapé
        canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, 38, doc.pagesize[0] - doc.rightMargin, 38)
        
        # Textos esquerdo e direito do rodapé
        canvas.drawString(doc.leftMargin, 25, "Simulador de Sistemas de Controle Dinâmico • Relatório PID")
        page_str = f"Execução #{run_id} | Página {doc.page}"
        canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 25, page_str)
        
        canvas.restoreState()
    return page_decorator

def generate_pdf_report(
    run_id: int,
    username: str,
    level_name: str,
    metrics: Dict[str, Any],
    score: float,
    code_snippet: str,
    time_series: List[Dict[str, Any]],
    created_at: datetime,
    prev_time_series: List[Dict[str, Any]] = None
) -> io.BytesIO:
    """
    Gera o laudo técnico em PDF no formato A4, com 3 páginas estruturadas:
    - Página 1: Cabeçalho, metadados da execução, 4 cards de métricas e índices de erro.
    - Página 2: Título, telemetria gráfica temporal e tabela de elementos representados.
    - Página 3: Implementação e código do algoritmo de controle executado pelo estudante.
    """
    pdf_buf = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buf,
        pagesize=A4,
        leftMargin=57,
        rightMargin=57,
        topMargin=45,
        bottomMargin=45
    )
    
    styles = getSampleStyleSheet()
    
    # Definição tipográfica moderna e consistente com o anexo de referência
    page_title_style = ParagraphStyle(
        'DocPageTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0D3B59'),
        spaceAfter=2
    )

    page_sub_style = ParagraphStyle(
        'DocPageSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=14
    )

    section_style = ParagraphStyle(
        'DocSection',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#008B8B'),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    meta_cell_style = ParagraphStyle(
        'MetaCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
    )

    card_cell_style = ParagraphStyle(
        'CardCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#0F172A'),
    )

    code_style = ParagraphStyle(
        'DocCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor('#1E293B'),
    )

    elements = []

    # =========================================================================
    # PÁGINA 1: DASHBOARD DE MÉTRICAS E METADADOS
    # =========================================================================
    elements.append(Paragraph("RELATÓRIO DE CONTROLE PID", page_title_style))
    elements.append(Paragraph("SIMULADOR DE SISTEMAS DE CONTROLE DINÂMICO • RELATÓRIO TÉCNICO", page_sub_style))
    elements.append(Spacer(1, 2))

    formatted_date = created_at.strftime("%d/%m/%Y às %H:%M:%S")
    meta_data = [
        [
            Paragraph('<font size="7.5" color="#64748B"><b>EXECUÇÃO</b></font><br/><font size="11" color="#0F172A"><b>#' + str(run_id) + '</b></font>', meta_cell_style),
            Paragraph('<font size="7.5" color="#64748B"><b>DATA / HORA</b></font><br/><font size="10" color="#0F172A">' + formatted_date + '</font>', meta_cell_style)
        ],
        [
            Paragraph('<font size="7.5" color="#64748B"><b>ESTUDANTE</b></font><br/><font size="10" color="#0F172A">' + username + '</font>', meta_cell_style),
            Paragraph('<font size="7.5" color="#64748B"><b>FASE / CENÁRIO</b></font><br/><font size="10" color="#0F172A">' + level_name + '</font>', meta_cell_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[240.6, 240.6])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0F7FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CCE2F5')),
        ('TOPPADDING', (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 9),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 14))

    # Métricas de Desempenho e Controle
    elements.append(Paragraph("Métricas de desempenho e controle", section_style))
    
    rise_val = f"{format_pt_br(metrics.get('rise_time'), 2)} s" if metrics.get('rise_time') is not None else "Não atingiu"
    overshoot_val = f"{format_pt_br(metrics.get('overshoot'), 1)}%" if metrics.get('overshoot') is not None else "--"
    settle_val = f"{format_pt_br(metrics.get('settling_time'), 2)} s" if metrics.get('settling_time') is not None else "Não estabilizou"
    err_val = f"{format_pt_br(abs(metrics.get('final_error')), 2)} m" if metrics.get('final_error') is not None else "--"

    card1_html = f'<font size="7.5" color="#64748B"><b>TEMPO DE SUBIDA (TR)</b></font><br/><br/><font size="18" color="#0F172A"><b>{rise_val}</b></font><br/><font size="7.5" color="#94A3B8">tr</font>'
    card2_html = f'<font size="7.5" color="#64748B"><b>SOBRESSINAL (MP)</b></font><br/><br/><font size="18" color="#0F172A"><b>{overshoot_val}</b></font><br/><font size="7.5" color="#94A3B8">Mp</font>'
    card3_html = f'<font size="7.5" color="#64748B"><b>TEMPO DE ACOMODAÇÃO (TS)</b></font><br/><br/><font size="18" color="#0F172A"><b>{settle_val}</b></font><br/><font size="7.5" color="#94A3B8">ts</font>'
    card4_html = f'<font size="7.5" color="#64748B"><b>ERRO FINAL (ESS)</b></font><br/><br/><font size="18" color="#0F172A"><b>{err_val}</b></font><br/><font size="7.5" color="#94A3B8">ess</font>'

    cards_data = [
        [Paragraph(card1_html, card_cell_style), '', Paragraph(card2_html, card_cell_style)],
        ['', '', ''],
        [Paragraph(card3_html, card_cell_style), '', Paragraph(card4_html, card_cell_style)]
    ]
    cards_table = Table(cards_data, colWidths=[235.6, 10, 235.6], rowHeights=[74, 10, 74])
    cards_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#FFFFFF')),
        ('BOX', (0,0), (0,0), 1, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (0,0), 9),
        ('BOTTOMPADDING', (0,0), (0,0), 9),
        ('LEFTPADDING', (0,0), (0,0), 12),
        ('RIGHTPADDING', (0,0), (0,0), 12),

        ('BACKGROUND', (2,0), (2,0), colors.HexColor('#FFFFFF')),
        ('BOX', (2,0), (2,0), 1, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (2,0), (2,0), 9),
        ('BOTTOMPADDING', (2,0), (2,0), 9),
        ('LEFTPADDING', (2,0), (2,0), 12),
        ('RIGHTPADDING', (2,0), (2,0), 12),

        ('BACKGROUND', (0,2), (0,2), colors.HexColor('#FFFFFF')),
        ('BOX', (0,2), (0,2), 1, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,2), (0,2), 9),
        ('BOTTOMPADDING', (0,2), (0,2), 9),
        ('LEFTPADDING', (0,2), (0,2), 12),
        ('RIGHTPADDING', (0,2), (0,2), 12),

        ('BACKGROUND', (2,2), (2,2), colors.HexColor('#FFFFFF')),
        ('BOX', (2,2), (2,2), 1, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (2,2), (2,2), 9),
        ('BOTTOMPADDING', (2,2), (2,2), 9),
        ('LEFTPADDING', (2,2), (2,2), 12),
        ('RIGHTPADDING', (2,2), (2,2), 12),

        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elements.append(cards_table)
    elements.append(Spacer(1, 14))

    # Índices Acumulados de Erro
    elements.append(Paragraph("Índices acumulados de erro", section_style))
    iae_str = format_pt_br(metrics.get('iae'), 2)
    ise_str = format_pt_br(metrics.get('ise'), 2)
    itae_str = format_pt_br(metrics.get('itae'), 2)

    indices_data = [
        [
            Paragraph('<font size="7.5" color="#64748B">IAE · Erro absoluto integral</font>', card_cell_style),
            Paragraph('<font size="7.5" color="#64748B">ISE · Erro quadrático integral</font>', card_cell_style),
            Paragraph('<font size="7.5" color="#64748B">ITAE · Erro × tempo</font>', card_cell_style),
        ],
        [
            Paragraph(f'<font size="16" color="#0F172A"><b>{iae_str}</b></font>', card_cell_style),
            Paragraph(f'<font size="16" color="#0F172A"><b>{ise_str}</b></font>', card_cell_style),
            Paragraph(f'<font size="16" color="#0F172A"><b>{itae_str}</b></font>', card_cell_style),
        ]
    ]
    indices_table = Table(indices_data, colWidths=[160.4, 160.4, 160.4])
    indices_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFFFF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor('#E2E8F0')),
        ('LINEAFTER', (0,0), (0,1), 0.5, colors.HexColor('#E2E8F0')),
        ('LINEAFTER', (1,0), (1,1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 9),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(indices_table)

    # Quebra para Página 2
    elements.append(PageBreak())

    # =========================================================================
    # PÁGINA 2: GRÁFICOS DE COMPORTAMENTO DINÂMICO E TELEMETRIA
    # =========================================================================
    elements.append(Paragraph("GRÁFICOS DE COMPORTAMENTO DINÂMICO", page_title_style))
    elements.append(Paragraph("Resposta do veículo, referência, erro e esforço de atuação ao longo da simulação.", page_sub_style))
    elements.append(Spacer(1, 2))

    elements.append(Paragraph("Resposta temporal e telemetria PID", section_style))
    chart_buf = generate_chart(time_series, prev_time_series)
    chart_image = Image(chart_buf, width=481, height=312)
    chart_image.hAlign = 'CENTER'
    elements.append(chart_image)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Elementos representados", section_style))
    elem_bold_style = ParagraphStyle(
        'ElemBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#0D3B59'),
    )
    elem_text_style = ParagraphStyle(
        'ElemText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155'),
    )
    elem_data = [
        [Paragraph("Posição y(t)", elem_bold_style), Paragraph("Posição do veículo ao longo do tempo.", elem_text_style)],
        [Paragraph("Meta r(t)", elem_bold_style), Paragraph("Referência definida para o cenário.", elem_text_style)],
        [Paragraph("Erro e(t)", elem_bold_style), Paragraph("Diferença entre referência e posição.", elem_text_style)],
        [Paragraph("Esforço u(t)", elem_bold_style), Paragraph("Força total e componentes P, I e D.", elem_text_style)],
    ]
    elem_table = Table(elem_data, colWidths=[120, 361])
    elem_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.HexColor('#F8FAFC'), colors.HexColor('#FFFFFF')]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(elem_table)
    elements.append(Spacer(1, 10))
    elements.append(Paragraph('<font size="8" color="#64748B">Os gráficos foram preservados do relatório original, sem recalcular ou alterar as curvas.</font>', body_style))

    # Quebra para Página 3
    elements.append(PageBreak())

    # =========================================================================
    # PÁGINA 3: ALGORITMO DE CONTROLE IMPLEMENTADO
    # =========================================================================
    elements.append(Paragraph("ALGORITMO DE CONTROLE IMPLEMENTADO", page_title_style))
    elements.append(Paragraph("Código JavaScript executado na malha de feedback da simulação.", page_sub_style))
    elements.append(Spacer(1, 4))

    elements.append(Paragraph("Algoritmo de controle implementado", section_style))
    elements.append(Paragraph("Trecho de código JavaScript executado na malha de feedback da simulação:", body_style))
    elements.append(Spacer(1, 6))

    # Formatação do código com escape de entidades HTML
    escaped_code = (
        code_snippet.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace(" ", "&nbsp;")
        .replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
        .replace("\n", "<br/>")
    )
    code_para = Paragraph(escaped_code, code_style)
    code_table = Table([[code_para]], colWidths=[481])
    code_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    elements.append(code_table)

    doc.build(
        elements,
        onFirstPage=make_page_canvas(run_id),
        onLaterPages=make_page_canvas(run_id),
    )
    pdf_buf.seek(0)
    return pdf_buf
