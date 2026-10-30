/* 
    MÓDULO DE FÍSICA E CONTROLE
    Responsável por calcular o movimento físico do veículo terrestre na pista 3D,
    integrar numericamente as forças do PID e as perturbações de relevo dinâmico.
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
    mass: 50,           // Massa do veículo (kg)
    friction: 2,        // Coeficiente de atrito viscoso (N*s/m)
    gravity: 9.81,      // Gravidade (m/s²)
    gEff: 9.81,         // Gravidade efetiva física para inclinações (F_relevo = -m * g * sin(angle))
    maxForce: 1500,     // Força motriz máxima do motor (N)
    disturbance: 0,     // Força gravitacional induzida pelo relevo da pista (N)
    terrainMode: 'flat', // 'flat', 'incline', 'decline', 'wave'
    
    currentLevel: 1,

    useCodeMode: true,
    enableAntiWindup: true, // Interruptor para alternar entre clamping (ON) e integrator windup autêntico (OFF)
    kp: 28.0,
    ki: 1.2,
    kd: 85.0,
    maxIntegral: 180,   // Saturação da integral calibrada para anti-windup ideal (erro final zero sem overshoot)
    lastForce: 0,       // Rastreio para anti-windup condicional

    // Rastreio de Métricas Didáticas
    simTime: 0,
    maxPos: 0,
    riseTime: null,
    timeOutsideTolerance: 0,
    settleStabilityTimer: 0,

    // Histórico de Ensaios
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
        SIM_STATE.lastForce = 0;
        SIM_STATE.disturbance = 0;
        
        SIM_STATE.iae = 0;
        SIM_STATE.ise = 0;
        SIM_STATE.itae = 0;
        
        SIM_STATE.simTime = 0;
        SIM_STATE.maxPos = 0;
        SIM_STATE.riseTime = null;
        SIM_STATE.timeOutsideTolerance = 0;
        SIM_STATE.settleStabilityTimer = 0;
        SIM_STATE.fullTelemetryData = [];
    },

    /**
     * Calcula a perturbação gravitacional induzida pela inclinação instantânea da pista
     * F_relevo = - m * g_eff * sin(alpha)
     */
    _calcInclineDisturbance: function() {
        if (window.Scene3D && typeof Scene3D.getElevationAndSlope === 'function') {
            const { angle } = Scene3D.getElevationAndSlope(SIM_STATE.position);
            // Gravidade efetiva física configurável (padrão 9.81 m/s² ou gEff do SIM_STATE)
            const gEff = (typeof SIM_STATE.gEff === 'number' && SIM_STATE.gEff > 0)
                ? SIM_STATE.gEff
                : (typeof SIM_STATE.gravity === 'number' && SIM_STATE.gravity > 0 ? SIM_STATE.gravity : 9.81);
            
            // F_relevo em Newtons: -m * g * sin(angle)
            SIM_STATE.disturbance = -SIM_STATE.mass * gEff * Math.sin(angle);
            return SIM_STATE.disturbance;
        }
        SIM_STATE.disturbance = 0;
        return 0;
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
        if (dt > 0.1) dt = 0.1; // Limite numérico para evitar divergência de passo

        // Perturbação externa de relevo 3D
        let externalDisturbance = PhysicsEngine._calcInclineDisturbance();

        let error = SIM_STATE.setPoint - SIM_STATE.position;
        let force = 0;
        let pTerm = 0;
        let iTerm = 0;
        let dTerm = 0;

        const maxLimit = (typeof SIM_STATE.maxForce === 'number' && SIM_STATE.maxForce > 0) ? SIM_STATE.maxForce : 1500;
        const maxInt = (typeof SIM_STATE.maxIntegral === 'number' && SIM_STATE.maxIntegral > 0) ? SIM_STATE.maxIntegral : 250;

        if (SIM_STATE.enableAntiWindup) {
            // Anti-windup condicional: não integra na mesma direção se atuador já estiver saturado
            const isSaturated = (SIM_STATE.lastForce >= maxLimit && error > 0) || 
                                (SIM_STATE.lastForce <= -maxLimit && error < 0);

            if (!isSaturated) {
                SIM_STATE.integral += error * dt;
            }

            // Anti-windup por limitação física (clamping) da integral
            SIM_STATE.integral = Math.max(-maxInt, Math.min(maxInt, SIM_STATE.integral));
        } else {
            // Sem anti-windup: integração contínua livre (demonstração clássica de Integrator Windup)
            SIM_STATE.integral += error * dt;
        }

        let derivative = (error - SIM_STATE.lastError) / dt;
        SIM_STATE.lastError = error;

        // Métricas de erro integral acumulado
        SIM_STATE.iae += Math.abs(error) * dt;
        SIM_STATE.ise += (error * error) * dt;
        SIM_STATE.itae += SIM_STATE.simTime * Math.abs(error) * dt;

        // === EXECUÇÃO EM SANDBOX DO CÓDIGO DO ALUNO ===
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
            force = pTerm + iTerm + dTerm - externalDisturbance;
        }

        // Limitação física de força do atuador
        force = Math.max(-maxLimit, Math.min(maxLimit, force));
        SIM_STATE.lastForce = force;

        // === MODELAGEM DINÂMICA DO VEÍCULO (2ª LEI DE NEWTON) ===
        // m * a = u(t) + F_relevo - b * v
        let netForce = force + externalDisturbance;
        let acceleration = (netForce - (SIM_STATE.friction * SIM_STATE.velocity)) / SIM_STATE.mass;
        
        // Integração numérica pelo Método de Euler Explícito
        SIM_STATE.velocity += acceleration * dt;
        SIM_STATE.position += SIM_STATE.velocity * dt;

        SIM_STATE.simTime += dt;

        // === MÉTRICAS TEMPORAIS (TRANSITÓRIO E REGIME) ===
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

        // === ATUALIZAÇÃO VISUAL E TELEMETRIA ===
        if (window.Scene3D && Scene3D.updateTransform) {
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

        // Telemetria síncrona
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

        // === CRITÉRIO DE ESTABILIZAÇÃO ===
        const stableThreshold = 1.5;
        if (SIM_STATE.settleStabilityTimer > stableThreshold) {
            SIM_STATE.isRunning = false;
            
            if (window.UIManager) {
                window.UIManager.setPlayButtonState(false);
            }

            const lvlName = "Carro na Pista 3D";
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
