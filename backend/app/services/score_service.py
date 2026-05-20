def calculate_run_score(
    level_name: str,
    rise_time: float | None,
    overshoot: float,
    settling_time: float | None,
    final_error: float
) -> float:
    """
    Calcula uma pontuação de 0 a 100 para o desempenho do PID do aluno.
    Lógica de dedução:
    - Começa em 100 pontos.
    - Deduz por overshoot alto.
    - Deduz pelo tempo de subida (quanto mais rápido atingir a meta, melhor).
    - Deduz pelo tempo de acomodação (estabilização).
    - Deduz pelo erro de regime estacionário.
    """
    score = 100.0

    # 1. Dedução de Erro Final (Muito crítica para o controle)
    abs_error = abs(final_error)
    score -= abs_error * 6.0  # -6 pontos para cada 1 unidade de erro final

    # 2. Dedução de Overshoot (Ultrapassagem)
    # Algum overshoot é tolerável, mas excessivo é ruim
    if "1" in level_name or "Carro" in level_name:
        # Carro: tolerância muito baixa de overshoot
        if overshoot > 5.0:
            score -= (overshoot - 5.0) * 1.5
    elif "2" in level_name or "Drone" in level_name:
        # Drone: tolerância média
        if overshoot > 15.0:
            score -= (overshoot - 15.0) * 1.0
    else:
        # Navio/Geral: tolerância maior
        if overshoot > 25.0:
            score -= (overshoot - 25.0) * 0.8

    # 3. Dedução de Tempo de Subida (Rapidez do sistema)
    if rise_time is not None:
        # Penaliza tempos de subida acima de 3 segundos
        if rise_time > 3.0:
            score -= (rise_time - 3.0) * 2.0
    else:
        # Se nunca subiu (sistema muito lento ou instável)
        score -= 30.0

    # 4. Dedução de Tempo de Acomodação (Estabilidade)
    if settling_time is not None:
        # Penaliza tempos de acomodação acima de 5 segundos
        if settling_time > 5.0:
            score -= (settling_time - 5.0) * 2.5
    else:
        # Se não acomodou
        score -= 40.0

    # Limita o score entre 0.0 e 100.0
    return max(0.0, min(100.0, round(score, 1)))
