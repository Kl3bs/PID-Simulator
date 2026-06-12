/**
 * MÓDULO DE GERENCIAMENTO DE FASES
 * Controla a ativação, configuração e transição entre as fases do simulador.
 */

window.LevelManager = {
  currentLevel: 1,

  levels: {
    1: {
      id: 1,
      name: "Carro na Pista",
      subtitle: "Controle de Posição Linear",
      difficulty: "INICIANTE",
      difficultyColor: "#04A777",
      headerGradient: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
      description: "Posicione o carro na linha de chegada usando controle PID.",
      tip: "Comece com <strong>Kp=0.5</strong>. Se o carro ultrapassar a meta, adicione <strong>Kd</strong> para frear.",
      defaultCode: `// Fase 1: Carro na Pista
let kp = 0.5;
let ki = 0.0;
let kd = 0.0;

let forca = (kp * error) + 
            (ki * integral) + 
            (kd * derivative);

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
        text: "Desafio: Sem Overshoot (< 5%)",
        check: (metrics) => metrics.overshoot < 5,
      },
    },
    2: {
      id: 2,
      name: "Drone no Vento",
      subtitle: "Controle de Altitude com Rajadas",
      difficulty: "AVANÇADO",
      difficultyColor: "#FFB703",
      headerGradient:
        "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      description:
        "Estabilize a altitude do drone mesmo com rajadas de vento imprevisíveis!",
      tip: "O vento aplica forças aleatórias. Use <strong>Kd alto</strong> para amortecer oscilações rápidas e um <strong>Ki moderado</strong> para compensar o desvio acumulado.",
      defaultCode: `// Fase 2: Drone em Rajadas de Vento
// 'disturbance' contém a força do vento atual
let kp = 1.2;
let ki = 0.4;
let kd = 0.8;

// O drone precisa compensar o vento!
let thrust = (kp * error) + 
             (ki * integral) + 
             (kd * derivative);

return thrust;`,
      targetLabel: "Altitude Alvo (m)",
      targetMin: 20,
      targetMax: 80,
      targetStep: 5,
      targetDefault: 50,
      statLabels: {
        pos: "Altitude",
        vel: "Vel. Vertical",
        err: "Desvio",
        ctrl: "Empuxo",
      },
      statUnits: { pos: "m", vel: "m/s", err: "m", ctrl: "N" },
      sceneModule: "SceneDrone",
      challenge: {
        text: "Desafio: Econômico (Acomodação < 5s)",
        check: (metrics) => metrics.settling_time < 5,
      },
    },
    3: {
      id: 3,
      name: "Navio no Porto",
      subtitle: "Atracação com Correntes Oceânicas",
      difficulty: "ESPECIALISTA",
      difficultyColor: "#FB5607",
      headerGradient:
        "linear-gradient(135deg, #0d3b59 0%, #1a6e8a 50%, #0d3b59 100%)",
      description:
        "Atraque o navio no cais com correntes oceânicas cíclicas perturbando sua trajetória!",
      tip: "A corrente é <strong>senoidal e persistente</strong>. Um Ki elevado é essencial para eliminar o erro em regime. Mas cuidado com o windup do integrador!",
      defaultCode: `// Fase 3: Navio Atracando no Porto
// Correntes oceânicas criam perturbação senoidal constante
let kp = 0.8;
let ki = 0.6;
let kd = 1.5;

// Anti-windup simples:
let integralClamped = Math.max(-200, Math.min(200, integral));

let rudder = (kp * error) + 
             (ki * integralClamped) + 
             (kd * derivative);

return rudder;`,
      targetLabel: "Posição do Cais (m)",
      targetMin: 150,
      targetMax: 450,
      targetStep: 30,
      targetDefault: 300,
      statLabels: {
        pos: "Posição Lateral",
        vel: "Vel. Lateral",
        err: "Desvio do Cais",
        ctrl: "Leme (Força)",
      },
      statUnits: { pos: "m", vel: "m/s", err: "m", ctrl: "N" },
      sceneModule: "SceneShip",
      challenge: {
        text: "Desafio: Rápido (Acomodação < 8s)",
        check: (metrics) => metrics.settling_time < 8,
      },
    },
  },

  init: function () {
    this.renderLevelSelector();
    this.activateLevel(1);
  },

  renderLevelSelector: function () {
    const selector = document.getElementById("level-selector");
    if (!selector) return;

    selector.innerHTML = ""; // Limpa botões hardcoded ou duplicados

    Object.values(this.levels).forEach((lvl) => {
      const btn = document.createElement("button");
      btn.className = "level-btn" + (lvl.id === 1 ? " active" : "");
      btn.dataset.levelId = lvl.id;
      btn.innerHTML = `
                <span class="level-btn-num">${lvl.id}</span>
                <span class="level-btn-info">
                    <span class="level-btn-name">${lvl.name}</span>
                    <span class="level-btn-diff" style="color:${lvl.difficultyColor}">${lvl.difficulty}</span>
                </span>
            `;
      btn.addEventListener("click", () => this.activateLevel(lvl.id));
      selector.appendChild(btn);
    });
  },

  activateLevel: function (levelId) {
    const lvl = this.levels[levelId];
    if (!lvl) return;

    // Para simulação se estiver rodando
    if (window.SIM_STATE && window.SIM_STATE.isRunning) {
      window.SIM_STATE.isRunning = false;
      if (window.PhysicsEngine) cancelAnimationFrame(PhysicsEngine.animationId);
    }

    this.currentLevel = levelId;

    // Atualiza badges de fase ativo
    document.querySelectorAll(".level-btn").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.levelId) === levelId);
    });

    // Troca header visual
    document.querySelector(".header").style.background = lvl.headerGradient;

    // Atualiza badge
    const badge = document.querySelector(".level-badge");
    if (badge) {
      badge.textContent = `FASE ${lvl.id}`;
      badge.style.background = lvl.difficultyColor;
    }

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
      document.getElementById("target-value").textContent = lvl.targetDefault;
    }

    // Atualiza código padrão
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
    } else if (challengePanel) {
      challengePanel.style.display = "none";
    }

    // Atualiza labels de telemetria
    const labels = lvl.statLabels;
    const units = lvl.statUnits;
    document.getElementById("stat-label-pos").textContent = labels.pos;
    document.getElementById("stat-label-vel").textContent = labels.vel;
    document.getElementById("stat-label-err").textContent = labels.err;
    document.getElementById("stat-label-ctrl").textContent = labels.ctrl;
    document.getElementById("stat-unit-pos").textContent = units.pos;
    document.getElementById("stat-unit-vel").textContent = units.vel;
    document.getElementById("stat-unit-err").textContent = units.err;
    document.getElementById("stat-unit-ctrl").textContent = units.ctrl;

    // Configura SIM_STATE para nova fase
    window.SIM_STATE = window.SIM_STATE || {};
    window.SIM_STATE.setPoint = lvl.targetDefault;
    window.SIM_STATE.currentLevel = levelId;
    window.SIM_STATE.disturbance = 0;

    // Garante que o painel de perturbação seja atualizado (ocultado se for Fase 1)
    if (window.UIManager && window.UIManager.updateDisturbance) {
      window.UIManager.updateDisturbance(0);
    }

    // Configura física por fase
    if (levelId === 1) {
      window.SIM_STATE.mass = 50;
      window.SIM_STATE.friction = 2;
      window.SIM_STATE.gravity = 0;
    } else if (levelId === 2) {
      window.SIM_STATE.mass = 2.5; // Drone leve
      window.SIM_STATE.friction = 0.5; // Arrasto do ar
      window.SIM_STATE.gravity = 9.8 * window.SIM_STATE.mass; // Peso do drone
    } else if (levelId === 3) {
      window.SIM_STATE.mass = 500; // Navio pesado
      window.SIM_STATE.friction = 15; // Resistência da água
      window.SIM_STATE.gravity = 0;
    }

    // Atualiza UI de Modelagem Matemática
    const m = window.SIM_STATE.mass;
    const b = window.SIM_STATE.friction;
    const g = window.SIM_STATE.gravity;

    const massEl = document.getElementById("model-mass");
    const fricEl = document.getElementById("model-friction");
    const gravEl = document.getElementById("model-gravity");
    const tfDenEl = document.getElementById("model-tf-den");

    if (massEl) massEl.textContent = m + (levelId === 3 ? " t" : " kg");
    if (fricEl) fricEl.textContent = b + " N·s/m";
    if (gravEl)
      gravEl.textContent =
        g > 0 ? `9.8 m/s² (Compensação: ${g.toFixed(1)} N)` : "N/A";
    if (tfDenEl) tfDenEl.textContent = `${m}s² + ${b}s`;

    // Reset geral
    if (window.PhysicsEngine && window.PhysicsEngine.reset) {
      PhysicsEngine.reset();
    }
    if (window.ChartAnalytics) ChartAnalytics.reset();
    if (window.UIManager) {
      UIManager.setPlayButtonState(false);
      UIManager.updateTelemetry(0, 0, lvl.targetDefault, 0);
    }

    // Troca a cena 3D
    this.switchScene(lvl.sceneModule, lvl.targetDefault);
  },

  switchScene: function (moduleName, setPoint) {
    // Destroi a cena anterior
    ["Scene3D", "SceneDrone", "SceneShip"].forEach((mod) => {
      if (window[mod] && window[mod].destroy) {
        window[mod].destroy();
      }
    });

    // Inicia nova cena
    if (window[moduleName] && window[moduleName].init) {
      window[moduleName].init("canvas-container", setPoint);
    }

    // Guarda referência da cena ativa
    window.ActiveScene = window[moduleName];
  },
};
