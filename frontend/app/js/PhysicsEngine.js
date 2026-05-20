/* 
    MÓDULO DE FÍSICA E CONTROLE
    Responsável por calcular movimento, simular a física e aplicar a lógica do PID.
    Suporta múltiplas fases com perturbações externas distintas.
*/


window.SIM_STATE = {
    isRunning: false,
    position: 0,
    velocity: 0,
    integral: 0,
    lastError: 0,
    lastTime: 0,
    
    setPoint: 600,
    mass: 50,
    friction: 2,
    gravity: 0,         // Gravidade (usada na fase do drone)
    disturbance: 0,     // Força de perturbação externa atual (vento, corrente)
    
    currentLevel: 1,    // Fase ativa

    useCodeMode: true,
    kp: 0.5,
    ki: 0,
    kd: 0,

    // Rastreio de Métricas
    simTime: 0,
    maxPos: 0,
    riseTime: null,
    timeOutsideTolerance: 0,
    settleStabilityTimer: 0,

    // Estado interno das perturbações
    _gustTimer: 0,
    _gustDuration: 0,
    _gustForce: 0,
    _gustActive: false,
    _baseWind: 0,
    _oceanPhase: 0,
    
    // Histórico de Runs
    runHistory: [],
    fullTelemetryData: []
};

window.PhysicsEngine = {
    animationId: null,
    
    reset: function() {
        SIM_STATE.position = 0;
        SIM_STATE.velocity = 0;
        SIM_STATE.integral = 0;
        SIM_STATE.lastError = SIM_STATE.setPoint;
        SIM_STATE.lastTime = 0;
        SIM_STATE.disturbance = 0;
        
        SIM_STATE.simTime = 0;
        SIM_STATE.maxPos = 0;
        SIM_STATE.riseTime = null;
        SIM_STATE.timeOutsideTolerance = 0;
        SIM_STATE.settleStabilityTimer = 0;

        // Reset perturbações
        SIM_STATE._gustTimer = 0;
        SIM_STATE._gustDuration = 0;
        SIM_STATE._gustForce = 0;
        SIM_STATE._gustActive = false;
        SIM_STATE._baseWind = 2 + Math.random() * 3;
        SIM_STATE._oceanPhase = 0;
        SIM_STATE.fullTelemetryData = [];
    },

    /**
     * FASE 2: Calcula perturbação de vento para o drone
     * Combina: vento base suave + rajadas repentinas + turbulência de alta frequência
     */
    _calcWindDisturbance: function(dt) {
        SIM_STATE._gustTimer += dt;

        // Vento base senoidal com variação lenta
        const baseWind = SIM_STATE._baseWind * Math.sin(SIM_STATE.simTime * 0.3) * SIM_STATE.mass;

        // Rajada aleatória periódica
        const gustInterval = 3 + Math.random() * 2; // Entre 3-5s
        if (!SIM_STATE._gustActive && SIM_STATE._gustTimer > gustInterval) {
            SIM_STATE._gustActive = true;
            SIM_STATE._gustTimer = 0;
            SIM_STATE._gustDuration = 0.4 + Math.random() * 0.8;           // Dura 0.4–1.2s
            SIM_STATE._gustForce = (Math.random() > 0.5 ? 1 : -1)         // Direção aleatória
                                  * (8 + Math.random() * 18)               // Intensidade 8–26 N
                                  * SIM_STATE.mass;
        }

        let gustContrib = 0;
        if (SIM_STATE._gustActive) {
            SIM_STATE._gustDuration -= dt;
            // Envelope trapezoidal: sobe rápido, sustenta, cai rápido
            gustContrib = SIM_STATE._gustForce * Math.min(1, SIM_STATE._gustDuration * 3);
            if (SIM_STATE._gustDuration <= 0) SIM_STATE._gustActive = false;
        }

        // Turbulência de alta frequência (ruído)
        const turbulence = (Math.random() - 0.5) * 4 * SIM_STATE.mass;

        SIM_STATE.disturbance = baseWind + gustContrib + turbulence;
        return SIM_STATE.disturbance;
    },

    /**
     * FASE 3: Calcula perturbação de corrente oceânica para o navio
     * Corrente senoidal de período longo + harmônico secundário + maré
     */
    _calcOceanDisturbance: function(dt) {
        SIM_STATE._oceanPhase += dt;
        const t = SIM_STATE._oceanPhase;

        // Corrente principal (período ~12s) — a grande maré
        const mainCurrent = Math.sin(t * 0.52) * 22 * SIM_STATE.mass;

        // Harmônico secundário (período ~5s) — ondas de meio-período
        const secondary = Math.sin(t * 1.26 + 1.1) * 8 * SIM_STATE.mass;

        // Componente de rajada de corrente (aumenta progressivamente)
        const surgeAmplitude = Math.min(15, SIM_STATE.simTime * 0.8); // Cresce com o tempo
        const surgeCurrent = Math.sin(t * 0.18 + 2.3) * surgeAmplitude * SIM_STATE.mass;

        // Ruído de turbulência aquática
        const turbulence = (Math.random() - 0.5) * 3 * SIM_STATE.mass;

        SIM_STATE.disturbance = mainCurrent + secondary + surgeCurrent + turbulence;
        return SIM_STATE.disturbance;
    },

    loop: function(timestamp) {
        if (!SIM_STATE.isRunning) return;
        
        if (!SIM_STATE.lastTime) {
            SIM_STATE.lastTime = timestamp;
            if (window.ChartAnalytics) window.ChartAnalytics.lastUpdateTime = timestamp;
            PhysicsEngine.animationId = requestAnimationFrame(PhysicsEngine.loop);
            return;
        }

        let dt = (timestamp - SIM_STATE.lastTime) / 1000;
        SIM_STATE.lastTime = timestamp;
        
        if (dt <= 0) {
            PhysicsEngine.animationId = requestAnimationFrame(PhysicsEngine.loop);
            return;
        }
        if (dt > 0.1) dt = 0.1;

        // === CALCULA PERTURBAÇÃO EXTERNA POR FASE ===
        let externalDisturbance = 0;
        if (SIM_STATE.currentLevel === 2) {
            externalDisturbance = PhysicsEngine._calcWindDisturbance(dt);
        } else if (SIM_STATE.currentLevel === 3) {
            externalDisturbance = PhysicsEngine._calcOceanDisturbance(dt);
        }

        let error = SIM_STATE.setPoint - SIM_STATE.position;
        let force = 0;

        SIM_STATE.integral += error * dt;
        let derivative = (error - SIM_STATE.lastError) / dt;
        SIM_STATE.lastError = error;

        // === EXECUTA CÓDIGO DO USUÁRIO ===
        if (SIM_STATE.useCodeMode) {
            try {
                const customCode = window.CodeEditor ? window.CodeEditor.getValue() : document.getElementById('custom-code').value;
                const userFunc = new Function('error', 'integral', 'derivative', 'velocity', 'position', 'disturbance', customCode);
                force = userFunc(error, SIM_STATE.integral, derivative, SIM_STATE.velocity, SIM_STATE.position, externalDisturbance);
                
                if (isNaN(force) || force === undefined) {
                    throw new Error("A função deve possuir 'return' com valor numérico.");
                }
                if (window.UIManager) window.UIManager.hideError();
            } catch (e) {
                force = 0;
                if (window.UIManager) {
                    window.UIManager.showError(e.message);
                    window.UIManager.setPlayButtonState(false);
                }
                SIM_STATE.isRunning = false;
                cancelAnimationFrame(PhysicsEngine.animationId);
                return;
            }
        } else {
            force = (SIM_STATE.kp * error) + (SIM_STATE.ki * SIM_STATE.integral) + (SIM_STATE.kd * derivative);
        }

        force = Math.max(-100000, Math.min(100000, force));

        // === DINÂMICA POR FASE ===
        let netForce = force + externalDisturbance;

        // Fase 2 (Drone): inclui gravidade e eixo Y
        if (SIM_STATE.currentLevel === 2) {
            netForce -= SIM_STATE.gravity; // O empuxo precisa superar o peso
        }

        let acceleration = (netForce - (SIM_STATE.friction * SIM_STATE.velocity)) / SIM_STATE.mass;
        SIM_STATE.velocity += acceleration * dt;

        // Fase 2: limita altitude ao chão (posição mínima = 0)
        SIM_STATE.position += SIM_STATE.velocity * dt;
        if (SIM_STATE.currentLevel === 2 && SIM_STATE.position < 0) {
            SIM_STATE.position = 0;
            SIM_STATE.velocity = 0;
        }
        SIM_STATE.simTime += dt;

        // === MÉTRICAS ===
        if (SIM_STATE.position > SIM_STATE.maxPos) {
            SIM_STATE.maxPos = SIM_STATE.position;
        }
        let overshootPercent = 0;
        if (SIM_STATE.maxPos > SIM_STATE.setPoint) {
            overshootPercent = ((SIM_STATE.maxPos - SIM_STATE.setPoint) / SIM_STATE.setPoint) * 100;
        }

        if (SIM_STATE.riseTime === null && SIM_STATE.position >= (SIM_STATE.setPoint * 0.9)) {
            SIM_STATE.riseTime = SIM_STATE.simTime;
        }

        let tol = Math.max(SIM_STATE.setPoint * 0.04, 1); // 4% de tolerância (mais difícil)
        if (Math.abs(error) > tol || Math.abs(SIM_STATE.velocity) > 0.5) {
            SIM_STATE.timeOutsideTolerance = SIM_STATE.simTime;
            SIM_STATE.settleStabilityTimer = 0;
        } else {
            SIM_STATE.settleStabilityTimer += dt;
        }

        // === ATUALIZA MÓDULOS VISUAIS ===
        const activeScene = window.ActiveScene;
        if (activeScene && activeScene.updateTransform) {
            activeScene.updateTransform(SIM_STATE.position, SIM_STATE.velocity, acceleration, dt);
        } else if (window.Scene3D) {
            Scene3D.updateTransform(SIM_STATE.position, SIM_STATE.velocity, acceleration, dt);
        }

        if (window.UIManager) {
            window.UIManager.updateTelemetry(SIM_STATE.position, SIM_STATE.velocity, error, force);
            window.UIManager.updateMetrics(
                SIM_STATE.riseTime, 
                overshootPercent, 
                SIM_STATE.timeOutsideTolerance, 
                error, 
                SIM_STATE.velocity
            );
            // Mostra perturbação na UI se disponível
            if (window.UIManager.updateDisturbance) {
                window.UIManager.updateDisturbance(externalDisturbance);
            }
        }
        if (window.ChartAnalytics) window.ChartAnalytics.tick(timestamp, SIM_STATE.position, SIM_STATE.setPoint, error, force, externalDisturbance);

        // Salva telemetria completa da simulação
        if (!SIM_STATE.fullTelemetryData) SIM_STATE.fullTelemetryData = [];
        SIM_STATE.fullTelemetryData.push({
            time: parseFloat(SIM_STATE.simTime.toFixed(3)),
            position: parseFloat(SIM_STATE.position.toFixed(3)),
            setpoint: parseFloat(SIM_STATE.setPoint.toFixed(3)),
            error: parseFloat(error.toFixed(3)),
            force: parseFloat(force.toFixed(3)),
            disturbance: parseFloat(externalDisturbance.toFixed(3))
        });

        // === CONDIÇÃO DE VITÓRIA (estabilidade > 2s nas fases difíceis) ===
        const stableThreshold = SIM_STATE.currentLevel === 1 ? 1.5 : 2.5;
        if (SIM_STATE.settleStabilityTimer > stableThreshold) {
            SIM_STATE.isRunning = false;
            
            if (window.UIManager) {
                window.UIManager.setPlayButtonState(false);
            }

            const lvlName = window.LevelManager ? window.LevelManager.levels[SIM_STATE.currentLevel].name : `Fase ${SIM_STATE.currentLevel}`;
            const code = window.CodeEditor ? window.CodeEditor.getValue() : document.getElementById('custom-code').value;

            // Solicita o nome do estudante para o relatório
            let username = prompt("Simulação Estabilizada! Digite seu nome para gerar o relatório PDF:", "Estudante");
            if (username === null) username = "Anônimo";
            if (username.trim() === "") username = "Anônimo";

            const payload = {
                username: username,
                level_name: lvlName,
                rise_time: SIM_STATE.riseTime,
                overshoot: overshootPercent,
                settling_time: SIM_STATE.timeOutsideTolerance,
                final_error: error,
                code_snippet: code,
                time_series: SIM_STATE.fullTelemetryData
            };

            // Envia os dados da run para o backend
            fetch("http://localhost:8081/api/v1/runs/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(res => {
                if (!res.ok) throw new Error("Erro ao salvar simulação no backend.");
                return res.json();
            })
            .then(data => {
                // Adiciona a run com ID real do banco e score calculado
                const runData = {
                    id: data.id,
                    score: data.score,
                    level: lvlName,
                    riseTime: SIM_STATE.riseTime,
                    overshoot: overshootPercent,
                    settlingTime: SIM_STATE.timeOutsideTolerance,
                    finalError: error,
                    codeSnippet: code
                };
                SIM_STATE.runHistory.push(runData);
                
                alert(`Simulação salva com sucesso! Pontuação obtida: ${data.score.toFixed(1)}/100.`);
                
                if (window.UIManager) {
                    window.UIManager.updateHistoryUI();
                }
            })
            .catch(err => {
                console.error(err);
                // Fallback local se o backend estiver inacessível
                const localId = SIM_STATE.runHistory.length + 1;
                const runData = {
                    id: `local_${localId}`,
                    score: 0,
                    level: lvlName,
                    riseTime: SIM_STATE.riseTime,
                    overshoot: overshootPercent,
                    settlingTime: SIM_STATE.timeOutsideTolerance,
                    finalError: error,
                    codeSnippet: code
                };
                SIM_STATE.runHistory.push(runData);
                alert("Não foi possível conectar com o backend. A rodada foi registrada apenas localmente.");
                
                if (window.UIManager) {
                    window.UIManager.updateHistoryUI();
                }
            });

            return;
        }

        PhysicsEngine.animationId = requestAnimationFrame(PhysicsEngine.loop);
    }
};
