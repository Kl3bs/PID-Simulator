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
      difficultyColor: "#00E396",
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
      name: "Bola na Barra (Ball & Beam)",
      subtitle: "Equilíbrio Instável (Duplo Integrador)",
      difficulty: "AVANÇADO",
      difficultyColor: "#FEB019",
      description:
        "Estabilize a esfera de aço na posição desejada sobre a barra inclinada articulada!",
      tip: "O sistema é <strong>instável em malha aberta</strong> (duplo integrador 1/s²). Sem o termo <strong>Kd (Derivativo)</strong>, a bola oscilará até cair da barra! Aumente o Kd para amortecer o movimento.",
      defaultCode: `// Fase 2: Ball and Beam (Bola na Barra)
// O sistema retorna o ângulo desejado da barra (graus, -20° a +20°)
let kp = 0.8;
let ki = 0.05;
let kd = 2.4; // Ação derivativa é CRUCIAL para não oscilar!

// Calcula a inclinação da barra necessária
let angulo = (kp * error) + 
             (ki * integral) + 
             (kd * derivative);

// Limita inclinação máxima da barra
angulo = Math.max(-20, Math.min(20, angulo));

return angulo;`,
      targetLabel: "Posição na Barra (cm)",
      targetMin: -40,
      targetMax: 40,
      targetStep: 5,
      targetDefault: 0,
      statLabels: {
        pos: "Posição da Bola",
        vel: "Vel. da Bola",
        err: "Erro de Centro",
        ctrl: "Ângulo Barra",
      },
      statUnits: { pos: "cm", vel: "cm/s", err: "cm", ctrl: "°" },
      sceneModule: "SceneBallAndBeam",
      challenge: {
        text: "Desafio: Estável no Centro (|Erro| < 2 cm)",
        check: (metrics) => Math.abs(metrics.error || 0) < 2,
      },
    },
    3: {
      id: 3,
      name: "Tanque de Nível Industrial",
      subtitle: "Controle de Nível e Processos",
      difficulty: "ESPECIALISTA",
      difficultyColor: "#9C6ADE",
      description:
        "Controle a altura da coluna de água no tanque contra o escoamento de dreno e vazamentos de demanda!",
      tip: "A bomba <strong>não admite valores negativos</strong> (ela só injeta água de 0 a 100%). Use <strong>Ki para eliminar o erro</strong> causado pela perda constante de água no dreno de Torricelli.",
      defaultCode: `// Fase 3: Tanque de Nível de Líquido
// Controle de bomba centrífuga (potência de 0 a 100%)
let kp = 1.8;
let ki = 0.25;
let kd = 0.4;

// Anti-windup com clamping para bomba que satura em [0, 100%]
let integralClamped = Math.max(-40, Math.min(60, integral));

let bomba = (kp * error) + 
            (ki * integralClamped) + 
            (kd * derivative);

// A bomba só injeta água (não aspira)
bomba = Math.max(0, Math.min(100, bomba));

return bomba;`,
      targetLabel: "Nível Alvo (cm)",
      targetMin: 10,
      targetMax: 90,
      targetStep: 5,
      targetDefault: 60,
      statLabels: {
        pos: "Nível da Água",
        vel: "Taxa de Nível",
        err: "Desvio do Nível",
        ctrl: "Potência Bomba",
      },
      statUnits: { pos: "cm", vel: "cm/s", err: "cm", ctrl: "%" },
      sceneModule: "SceneWaterTank",
      challenge: {
        text: "Desafio: Sem Transbordo (|Erro| < 1.5 cm)",
        check: (metrics) => Math.abs(metrics.error || 0) < 1.5,
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
      if (window.PhysicsEngine) cancelAnimationFrame(window.PhysicsEngine.animationId);
    }

    this.currentLevel = levelId;

    // Atualiza badges de fase ativo
    document.querySelectorAll(".level-btn").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.levelId) === levelId);
    });

    // Troca header visual — remove qualquer estilo inline residual de background
    const header = document.querySelector(".header");
    if (header) {
      header.style.removeProperty("background");
      header.style.removeProperty("background-image");
      header.style.background = "";
      header.setAttribute("data-level", levelId);
    }

    // Atualiza badge
    const badge = document.querySelector(".level-badge");
    if (badge) {
      badge.textContent = `FASE ${lvl.id}`;
      // Remove inline style para herdar o CSS do token --accent
      badge.style.removeProperty("background");
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

    // Visibilidade da barra de relevo 3D (apenas Fase 1)
    const terrainToolbar = document.getElementById("terrain-toolbar");
    if (terrainToolbar) {
      terrainToolbar.style.display = levelId === 1 ? "flex" : "none";
    }

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
      window.SIM_STATE.mass = 0.5; // Esfera de aço 0.5 kg
      window.SIM_STATE.friction = 0.4; // Atrito de rolamento
      window.SIM_STATE.gravity = 980; // Gravidade efetiva (cm/s²)
    } else if (levelId === 3) {
      window.SIM_STATE.mass = 100; // Tanque 100 L
      window.SIM_STATE.friction = 1.2; // Resistência hidráulica
      window.SIM_STATE.gravity = 9.8;
    }

    // Atualiza UI de Modelagem Matemática
    const m = window.SIM_STATE.mass;
    const b = window.SIM_STATE.friction;
    const g = window.SIM_STATE.gravity;

    const massEl = document.getElementById("model-mass");
    const fricEl = document.getElementById("model-friction");
    const gravEl = document.getElementById("model-gravity");
    const tfDenEl = document.getElementById("model-tf-den");

    if (massEl) massEl.textContent = levelId === 1 ? m + " kg" : (levelId === 2 ? m + " kg (Esfera)" : "100 L (Tanque)");
    if (fricEl) fricEl.textContent = levelId === 3 ? "Rh = " + b + " s/cm²" : b + " N·s/m";
    if (gravEl)
      gravEl.textContent =
        levelId === 1 ? "N/A (Rampa opcional)" : (levelId === 2 ? "9.8 m/s² (g·sin α)" : "Torricelli √(2gh)");
    if (tfDenEl) tfDenEl.textContent = levelId === 1 ? `${m}s² + ${b}s` : (levelId === 2 ? "s² (Duplo Integrador)" : "12.0s + 1 (1ª Ordem)");

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

    // Troca a cena 3D
    this.switchScene(lvl.sceneModule, lvl.targetDefault);
  },

  switchScene: function (moduleName, setPoint) {
    // Destroi a cena anterior
    ["Scene3D", "SceneBallAndBeam", "SceneWaterTank", "SceneDrone", "SceneShip"].forEach((mod) => {
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
