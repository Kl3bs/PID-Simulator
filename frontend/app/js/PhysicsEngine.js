/* 
    MÓDULO DE FÍSICA E CONTROLE
    Responsável por calcular movimento, simular a física e aplicar a lógica do PID.
    Suporta múltiplas fases com perturbações externas distintas e relevo dinâmico.
*/

window.SIM_STATE = {
    isRunning: false,
    position: 0,
    velocity: 0,
    integral: 0,
    lastError: 0,
    lastTime: 0,
    
    iae: 0,
    ise: 0,
    itae: 0,
    
    setPoint: 600,
    mass: 50,
    friction: 2,
    gravity: 0,         // Gravidade (usada na fase do drone)
    disturbance: 0,     // Força de perturbação externa atual (vento, corrente, relevo)
    terrainMode: 'flat', // Modo de relevo da Fase 1 ('flat', 'incline', 'decline', 'wave')
    
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
        
        SIM_STATE.iae = 0;
        SIM_STATE.ise = 0;
        SIM_STATE.itae = 0;
        
        SIM_STATE.simTime = 0;
        SIM_STATE.maxPos = 0;
        SIM_STATE.riseTime = null;
        SIM_STATE.timeOutsideTolerance = 0;
        SIM_STATE.settleStabilityTimer = 0;

        // Reset perturbações e estados específicos das fases
        SIM_STATE._gustTimer = 0;
        SIM_STATE._gustDuration = 0;
        SIM_STATE._gustForce = 0;
        SIM_STATE._gustActive = false;
        SIM_STATE.beamAngle = 0;
        SIM_STATE.pumpPower = 0;
        SIM_STATE.fullTelemetryData = [];
    },

    /**
     * FASE 1: Calcula perturbação gravitacional de aclives/declives na pista
     */
    _calcInclineDisturbance: function() {
        if (window.Scene3D && typeof Scene3D.getElevationAndSlope === 'function') {
            const { angle } = Scene3D.getElevationAndSlope(SIM_STATE.position);
            // Força no plano inclinado: F = - m * g_eff * sin(alpha)
            const gEff = 350;
            SIM_STATE.disturbance = -SIM_STATE.mass * gEff * Math.sin(angle);
            return SIM_STATE.disturbance;
        }
        SIM_STATE.disturbance = 0;
        return 0;
    },

    /**
     * FASE 2: Calcula perturbação externa na barra (impulso / desbalanceamento)
     */
    _calcBeamDisturbance: function(dt) {
        SIM_STATE._gustTimer += dt;
        // A cada 4 segundos, simula um leve toque ou desbalanceamento na barra
        if (SIM_STATE._gustTimer > 4.5) {
            SIM_STATE._gustTimer = 0;
            SIM_STATE._gustActive = true;
            SIM_STATE._gustDuration = 0.35;
            SIM_STATE._gustForce = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25);
        }

        let dist = 0;
        if (SIM_STATE._gustActive) {
            SIM_STATE._gustDuration -= dt;
            dist = SIM_STATE._gustForce;
            if (SIM_STATE._gustDuration <= 0) SIM_STATE._gustActive = false;
        }

        SIM_STATE.disturbance = dist;
        return SIM_STATE.disturbance;
    },

    /**
     * FASE 3: Calcula perturbação de vazamento / consumo de vazão no tanque de água
     */
    _calcTankLeakDisturbance: function(dt) {
        // Simula uma abertura periódica ou constante de válvula de demanda
        const baseLeak = 1.2;
        const waveDemand = 0.5 * Math.sin(SIM_STATE.simTime * 0.4);
        SIM_STATE.disturbance = baseLeak + waveDemand;
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
        if (SIM_STATE.currentLevel === 1) {
            externalDisturbance = PhysicsEngine._calcInclineDisturbance();
        } else if (SIM_STATE.currentLevel === 2) {
            externalDisturbance = PhysicsEngine._calcBeamDisturbance(dt);
        } else if (SIM_STATE.currentLevel === 3) {
            externalDisturbance = PhysicsEngine._calcTankLeakDisturbance(dt);
        }

        let error = SIM_STATE.setPoint - SIM_STATE.position;
        let force = 0;
        let pTerm = 0;
        let iTerm = 0;
        let dTerm = 0;

        SIM_STATE.integral += error * dt;
        let derivative = (error - SIM_STATE.lastError) / dt;
        SIM_STATE.lastError = error;

        // Métricas de erro integral
        SIM_STATE.iae += Math.abs(error) * dt;
        SIM_STATE.ise += (error * error) * dt;
        SIM_STATE.itae += SIM_STATE.simTime * Math.abs(error) * dt;

        // === EXECUTA CÓDIGO DO USUÁRIO COM DECOMPOSIÇÃO DE FORÇAS ===
        if (SIM_STATE.useCodeMode) {
            try {
                const customCode = window.CodeEditor ? window.CodeEditor.getValue() : (document.getElementById('custom-code') ? document.getElementById('custom-code').value : '');
                const userFunc = new Function('error', 'integral', 'derivative', 'velocity', 'position', 'disturbance', customCode);
                const rawOutput = userFunc(error, SIM_STATE.integral, derivative, SIM_STATE.velocity, SIM_STATE.position, externalDisturbance);
                
                if (typeof rawOutput === 'object' && rawOutput !== null) {
                    force = Number(rawOutput.force ?? rawOutput.u ?? 0);
                    pTerm = Number(rawOutput.up ?? (SIM_STATE.kp * error));
                    iTerm = Number(rawOutput.ui ?? (SIM_STATE.ki * SIM_STATE.integral));
                    dTerm = Number(rawOutput.ud ?? (SIM_STATE.kd * derivative));
                } else {
                    force = Number(rawOutput);
                    pTerm = SIM_STATE.kp ? (SIM_STATE.kp * error) : force;
                    iTerm = SIM_STATE.ki ? (SIM_STATE.ki * SIM_STATE.integral) : 0;
                    dTerm = SIM_STATE.kd ? (SIM_STATE.kd * derivative) : 0;
                }

                if (isNaN(force) || force === undefined) {
                    throw new Error("A função deve possuir 'return' com valor numérico.");
                }
                if (window.UIManager && window.UIManager.hideError) window.UIManager.hideError();
            } catch (e) {
                force = 0;
                if (window.UIManager) {
                    window.UIManager.showError(e.message);
                    window.UIManager.setPlayButtonState(false);
                }
                SIM_STATE.isRunning = false;
                if (window.PhysicsEngine) cancelAnimationFrame(window.PhysicsEngine.animationId);
                return;
            }
        } else {
            pTerm = SIM_STATE.kp * error;
            iTerm = SIM_STATE.ki * SIM_STATE.integral;
            dTerm = SIM_STATE.kd * derivative;
            force = pTerm + iTerm + dTerm;
        }

        force = Math.max(-100000, Math.min(100000, force));

        let acceleration = 0;

        // === DINÂMICA POR FASE ===
        if (SIM_STATE.currentLevel === 1) {
            // FASE 1: Carro na pista com relevo e atrito viscoso
            let netForce = force + externalDisturbance;
            acceleration = (netForce - (SIM_STATE.friction * SIM_STATE.velocity)) / SIM_STATE.mass;
            SIM_STATE.velocity += acceleration * dt;
            SIM_STATE.position += SIM_STATE.velocity * dt;
        } else if (SIM_STATE.currentLevel === 2) {
            // FASE 2: Ball and Beam (Bola na Barra)
            // O sinal de controle define a inclinação angular da barra (em graus, limitado a +-25°)
            const alphaDeg = Math.max(-25, Math.min(25, force));
            const alphaRad = (alphaDeg * Math.PI) / 180;
            SIM_STATE.beamAngle = alphaRad;

            // Aceleração da esfera: (5/7) * g * sin(alpha) - atrito + perturbação
            const gEff = 980; // cm/s²
            acceleration = (5 / 7) * gEff * Math.sin(alphaRad) - (SIM_STATE.friction * SIM_STATE.velocity) + externalDisturbance;
            SIM_STATE.velocity += acceleration * dt;
            SIM_STATE.position += SIM_STATE.velocity * dt;

            // Batentes físicos inelásticos nas extremidades (-46 cm e +46 cm)
            if (SIM_STATE.position > 46) {
                SIM_STATE.position = 46;
                SIM_STATE.velocity = -SIM_STATE.velocity * 0.15;
            } else if (SIM_STATE.position < -46) {
                SIM_STATE.position = -46;
                SIM_STATE.velocity = -SIM_STATE.velocity * 0.15;
            }
        } else if (SIM_STATE.currentLevel === 3) {
            // FASE 3: Tanque de Nível Industrial
            // O sinal de controle define a potência da bomba centrífuga (0 a 100%, sem valores negativos)
            const pumpPower = Math.max(0, Math.min(100, force));
            SIM_STATE.pumpPower = pumpPower;

            // Vazão de entrada proporcional e escoamento gravitacional de Torricelli
            const qIn = (pumpPower / 100) * 8.2; // Vazão máx de enchimento ~8.2 cm/s
            const qOut = 0.42 * Math.sqrt(Math.max(0, SIM_STATE.position)); // Torricelli
            const dh_dt = qIn - qOut - externalDisturbance;

            acceleration = (dh_dt - SIM_STATE.velocity) / Math.max(0.001, dt);
            SIM_STATE.velocity = dh_dt;
            SIM_STATE.position += SIM_STATE.velocity * dt;

            // Limites de coluna de água (0 a 100 cm)
            if (SIM_STATE.position < 0) {
                SIM_STATE.position = 0;
                SIM_STATE.velocity = 0;
            } else if (SIM_STATE.position > 100) {
                SIM_STATE.position = 100;
                SIM_STATE.velocity = 0;
            }
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

        let tol = Math.max(SIM_STATE.setPoint * 0.04, 1);
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
                SIM_STATE.velocity,
                SIM_STATE.iae,
                SIM_STATE.ise,
                SIM_STATE.itae
            );
            if (window.UIManager.updateDisturbance) {
                window.UIManager.updateDisturbance(externalDisturbance);
            }
        }
        
        if (window.ChartAnalytics) {
            window.ChartAnalytics.tick(
                timestamp, 
                SIM_STATE.position, 
                SIM_STATE.setPoint, 
                error, 
                force, 
                externalDisturbance,
                pTerm,
                iTerm,
                dTerm
            );
        }

        // Salva telemetria completa da simulação
        if (!SIM_STATE.fullTelemetryData) SIM_STATE.fullTelemetryData = [];
        SIM_STATE.fullTelemetryData.push({
            time: parseFloat(SIM_STATE.simTime.toFixed(3)),
            position: parseFloat(SIM_STATE.position.toFixed(3)),
            setpoint: parseFloat(SIM_STATE.setPoint.toFixed(3)),
            error: parseFloat(error.toFixed(3)),
            force: parseFloat(force.toFixed(3)),
            u_p: parseFloat(pTerm.toFixed(3)),
            u_i: parseFloat(iTerm.toFixed(3)),
            u_d: parseFloat(dTerm.toFixed(3)),
            disturbance: parseFloat(externalDisturbance.toFixed(3))
        });

        // === CONDIÇÃO DE ESTABILIZAÇÃO ===
        const stableThreshold = SIM_STATE.currentLevel === 1 ? 1.5 : 2.5;
        if (SIM_STATE.settleStabilityTimer > stableThreshold) {
            SIM_STATE.isRunning = false;
            
            if (window.UIManager) {
                window.UIManager.setPlayButtonState(false);
            }

            const lvlName = window.LevelManager ? window.LevelManager.levels[SIM_STATE.currentLevel].name : `Fase ${SIM_STATE.currentLevel}`;
            const code = window.CodeEditor ? window.CodeEditor.getValue() : (document.getElementById('custom-code') ? document.getElementById('custom-code').value : '');

            const payload = {
                username: "pendente",
                level_name: lvlName,
                rise_time: SIM_STATE.riseTime,
                overshoot: overshootPercent,
                settling_time: SIM_STATE.timeOutsideTolerance,
                final_error: error,
                iae: SIM_STATE.iae,
                ise: SIM_STATE.ise,
                itae: SIM_STATE.itae,
                code_snippet: code,
                time_series: SIM_STATE.fullTelemetryData
            };

            if (window.UIManager && window.UIManager.showResultModal) {
                window.UIManager.showResultModal(payload);
            }

            return;
        }

        PhysicsEngine.animationId = requestAnimationFrame(PhysicsEngine.loop);
    }
};
