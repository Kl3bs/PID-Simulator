/**
 * MÓDULO DE CONFIGURAÇÃO DA BANCADA DIDÁTICA
 * Configura e gerencia a planta de simulação do Carro na Pista 3D com Relevo.
 */

window.LevelManager = {
  currentLevel: 1,

  levels: {
    1: {
      id: 1,
      name: "Carro na Pista 3D",
      subtitle: "Controle de Posição Linear com Relevo Dinâmico",
      difficulty: "BANCADA DIDÁTICA",
      difficultyColor: "#00E396",
      description:
        "Posicione o veículo terrestre na linha de chegada usando controle PID.",
      tip: "Benchmark do TCC: <strong>Kp=28.0</strong>, <strong>Ki=1.2</strong> e <strong>Kd=85.0</strong>. Use o botão <strong>Anti-Windup</strong> na barra superior para alternar entre clamping (sem overshoot) e windup real!",
      defaultCode: `// Controle de Posição do Veículo na Pista 3D 
let kp = 28.0;
let ki = 1.2;
let kd = 85.0;

// Força PID + Feedforward da perturbação de relevo (-disturbance)
// Dica: Alterne o botão 'Anti-Windup' na barra para ver o efeito do Clamping
let forca = (kp * error) + 
            (ki * integral) + 
            (kd * derivative) - disturbance;

// Limite do atuador do motor [-1500N, 1500N]
forca = Math.max(-1500, Math.min(1500, forca));

return forca;`,
      targetLabel: "Meta da Pista (m)",
      targetMin: 100,
      targetMax: 900,
      targetStep: 50,
      targetDefault: 600,
      statLabels: {
        pos: "Posição Atual",
        vel: "Velocidade",
        err: "Distância (Erro)",
        ctrl: "Força Aplicada",
      },
      statUnits: { pos: "m", vel: "m/s", err: "m", ctrl: "N" },
      sceneModule: "Scene3D",
      challenge: {
        text: "Desafio: Sem Overshoot (< 5%) na rampa",
        check: (metrics) => metrics.overshoot < 5,
      },
    },
  },

  init: function () {
    this.activateLevel(1);
  },

  activateLevel: function (levelId) {
    const lvl = this.levels[1];
    if (!lvl) return;

    // Para simulação se estiver rodando
    if (window.SIM_STATE && window.SIM_STATE.isRunning) {
      window.SIM_STATE.isRunning = false;
      if (window.PhysicsEngine)
        cancelAnimationFrame(window.PhysicsEngine.animationId);
    }

    this.currentLevel = 1;

    // Atualiza título do header
    const h1 = document.querySelector(".header h1");
    const subtitle = document.querySelector(".header .header-subtitle");
    if (h1) h1.textContent = lvl.name;
    if (subtitle) subtitle.textContent = lvl.subtitle;

    // Atualiza labels do slider
    const targetLabel = document.getElementById("target-label");
    if (targetLabel) targetLabel.textContent = lvl.targetLabel;
    const slider = document.getElementById("target-slider");
    if (slider) {
      slider.min = lvl.targetMin;
      slider.max = lvl.targetMax;
      slider.step = lvl.targetStep;
      slider.value = lvl.targetDefault;
      const targetValEl = document.getElementById("target-value");
      if (targetValEl) targetValEl.textContent = lvl.targetDefault;
    }

    // Atualiza código padrão no editor
    if (window.CodeEditor && window.CodeEditor.setValue) {
      window.CodeEditor.setValue(lvl.defaultCode);
    }

    // Atualiza dica de aprendizado
    const tipEl = document.getElementById("level-tip");
    if (tipEl) tipEl.innerHTML = lvl.tip;

    // Atualiza Desafio UI
    const challengeDescEl = document.getElementById("challenge-desc");
    const challengePanel = document.getElementById("challenge-panel");
    if (lvl.challenge && challengeDescEl) {
      challengeDescEl.textContent = lvl.challenge.text;
      if (challengePanel) challengePanel.style.display = "block";
    }

    // Atualiza labels de telemetria
    const labels = lvl.statLabels;
    const units = lvl.statUnits;
    if (document.getElementById("stat-label-pos"))
      document.getElementById("stat-label-pos").textContent = labels.pos;
    if (document.getElementById("stat-label-vel"))
      document.getElementById("stat-label-vel").textContent = labels.vel;
    if (document.getElementById("stat-label-err"))
      document.getElementById("stat-label-err").textContent = labels.err;
    if (document.getElementById("stat-label-ctrl"))
      document.getElementById("stat-label-ctrl").textContent = labels.ctrl;
    if (document.getElementById("stat-unit-pos"))
      document.getElementById("stat-unit-pos").textContent = units.pos;
    if (document.getElementById("stat-unit-vel"))
      document.getElementById("stat-unit-vel").textContent = units.vel;
    if (document.getElementById("stat-unit-err"))
      document.getElementById("stat-unit-err").textContent = units.err;
    if (document.getElementById("stat-unit-ctrl"))
      document.getElementById("stat-unit-ctrl").textContent = units.ctrl;

    // Configura SIM_STATE para o Carro na Pista
    window.SIM_STATE = window.SIM_STATE || {};
    window.SIM_STATE.setPoint = lvl.targetDefault;
    window.SIM_STATE.currentLevel = 1;
    window.SIM_STATE.disturbance = 0;
    window.SIM_STATE.mass = 50;
    window.SIM_STATE.friction = 2;
    window.SIM_STATE.gravity = 9.81;
    window.SIM_STATE.gEff = 9.81;
    window.SIM_STATE.maxForce = 1500;
    window.SIM_STATE.maxIntegral = 180;
    window.SIM_STATE.kp = 28.0;
    window.SIM_STATE.ki = 1.2;
    window.SIM_STATE.kd = 85.0;

    // Visibilidade da barra de relevo 3D
    const terrainToolbar = document.getElementById("terrain-toolbar");
    if (terrainToolbar) {
      terrainToolbar.style.display = "flex";
    }

    // Atualiza UI de Modelagem Matemática
    const massEl = document.getElementById("model-mass");
    const fricEl = document.getElementById("model-friction");
    const gravEl = document.getElementById("model-gravity");
    const tfDenEl = document.getElementById("model-tf-den");

    if (massEl) massEl.textContent = "50 kg";
    if (fricEl) fricEl.textContent = "2 N·s/m";
    if (gravEl) gravEl.textContent = "F_relevo = -m·g·sin(α)";
    if (tfDenEl) tfDenEl.textContent = "50s² + 2s";

    // Reset geral
    if (window.PhysicsEngine && window.PhysicsEngine.reset) {
      window.PhysicsEngine.reset();
    }
    if (window.ChartAnalytics && window.ChartAnalytics.reset) {
      window.ChartAnalytics.reset();
    }
    if (window.UIManager) {
      window.UIManager.setPlayButtonState(false);
      window.UIManager.updateTelemetry(0, 0, lvl.targetDefault, 0);
    }

    // Inicia a cena 3D (Scene3D)
    this.switchScene("Scene3D", lvl.targetDefault);
  },

  switchScene: function (moduleName, setPoint) {
    if (window.Scene3D && window.Scene3D.init) {
      window.Scene3D.init("canvas-container", setPoint);
    }
    window.ActiveScene = window.Scene3D;
  },
};
