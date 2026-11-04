/*
    MÓDULO DE INTERFACE DO USUÁRIO (UI)
    Responsável por todos os inputs (botões, sliders) e outputs (telemetria, métricas).
    Suporta múltiplas fases com labels dinâmicas e painel de perturbação.
*/

// Detecta se está rodando localmente ou em produção
const isLocalEnv =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "0.0.0.0" ||
  window.location.hostname === "" ||
  window.location.hostname.endsWith(".local") ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("172.");

const API_BASE_URL = isLocalEnv
  ? `http://${window.location.hostname === "0.0.0.0" || !window.location.hostname ? "localhost" : window.location.hostname}:8081`
  : "https://sketch-1-backend.onrender.com";


window.UIManager = {
  init: function () {
    // Slider de alvo (meta / altitude / posição do cais)
    const slider = document.getElementById("target-slider");
    const display = document.getElementById("target-value");
    if (slider) {
      slider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        display.innerText = val.toFixed(0);
        window.SIM_STATE.setPoint = val;

        // Atualiza linha de meta na cena ativa
        const activeScene = window.ActiveScene;
        if (activeScene && activeScene.updateTargetLine) {
          activeScene.updateTargetLine(val);
        } else if (window.Scene3D) {
          window.Scene3D.updateTargetLine(val);
        }
      });
    }

    // Troca de abas e sincronização com icon-rail
    const selectTab = (tabName) => {
      if (!tabName) return;
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
      document
        .querySelectorAll(".icon-rail-btn[data-tab]")
        .forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      const targetEl = document.getElementById(tabName);
      if (targetEl) targetEl.classList.add("active");
      if (
        tabName === "chart" &&
        window.ChartAnalytics &&
        window.ChartAnalytics.chart
      ) {
        setTimeout(() => window.ChartAnalytics.chart.resize(), 100);
      }
    };

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectTab(btn.dataset.tab));
    });

    document.querySelectorAll(".icon-rail-btn[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => selectTab(btn.dataset.tab));
    });

    document.getElementById("rail-btn-learn")?.addEventListener("click", () => {
      selectTab("learn");
    });

    // Botão Simular / Pausa
    document.getElementById("play-btn").addEventListener("click", () => {
      if (!window.SIM_STATE.isRunning) {
        window.SIM_STATE.isRunning = true;
        window.SIM_STATE.lastTime = 0;
        window.SIM_STATE.lastError =
          window.SIM_STATE.setPoint - window.SIM_STATE.position;
        this.setPlayButtonState(true);
        if (window.PhysicsEngine) {
          window.PhysicsEngine.animationId = requestAnimationFrame(window.PhysicsEngine.loop);
        }
      } else {
        window.SIM_STATE.isRunning = false;
        this.setPlayButtonState(false);
        cancelAnimationFrame(window.PhysicsEngine?.animationId);
      }
    });

    // Botão Reset
    document.getElementById("reset-btn").addEventListener("click", () => {
      window.SIM_STATE.isRunning = false;
      cancelAnimationFrame(window.PhysicsEngine?.animationId);
      this.setPlayButtonState(false);

      window.PhysicsEngine?.reset();

      // Reset da cena ativa
      const activeScene = window.ActiveScene;
      if (activeScene && activeScene.reset) {
        activeScene.reset();
      } else if (window.Scene3D) {
        Scene3D.reset();
      }

      if (window.ChartAnalytics) ChartAnalytics.reset();
      this.updateTelemetry(0, 0, window.SIM_STATE.setPoint, 0);
      this.hideError();

      document.getElementById("rise-time").textContent = "--";
      document.getElementById("overshoot").textContent = "--";
      document.getElementById("final-error").textContent = "--";
      document.getElementById("settling-time").textContent = "--";
      this.updateDisturbance(0);
    });

    // Inicializa CodeMirror
    try {
      if (window.CodeEditor) {
        window.CodeEditor.init("custom-code");
      }
    } catch (e) {
      console.error("Erro ao inicializar CodeMirror:", e);
    }

    // Botão - Exportar CSV do Histórico (Stateless / Client-side)
    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const selectedRadio = document.querySelector(
          'input[name="export_run_id"]:checked',
        );
        if (selectedRadio) {
          this.downloadRunCSV(selectedRadio.value);
          selectedRadio.checked = false;
          return;
        }

        const history = window.SIM_STATE.runHistory || [];
        if (history.length === 0) {
          alert("Nenhuma simulação no histórico para exportar.");
          return;
        }

        const headers = [
          "Run ID", "Estudante", "Fase", "Tempo de Subida (s)", "Sobressinal (%)",
          "Tempo Acomodacao (s)", "Erro Final (m)", "Pontuacao", "Data"
        ];
        const rows = history.map((r) => [
          r.id,
          `"${r.username || "Anônimo"}"`,
          `"${r.level || "Fase 1"}"`,
          r.riseTime !== null && r.riseTime !== undefined ? Number(r.riseTime).toFixed(2) : "",
          r.overshoot !== undefined && r.overshoot !== null ? Number(r.overshoot).toFixed(2) : "",
          r.settlingTime !== null && r.settlingTime !== undefined ? Number(r.settlingTime).toFixed(2) : "",
          r.finalError !== undefined && r.finalError !== null ? Math.abs(Number(r.finalError)).toFixed(2) : "",
          r.score !== undefined && r.score !== null ? Number(r.score).toFixed(1) : "",
          r.date ? new Date(r.date).toLocaleString("pt-BR") : ""
        ].join(","));

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `historico_simulacoes_pid_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
    }

    // Botão - Limpar Histórico do Navegador
    const clearHistoryBtn = document.getElementById("clear-history-btn");
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", () => {
        this.clearHistory();
      });
    }

    // Modal - Fechar no (X)
    const btnCloseModal = document.getElementById("modal-btn-close");
    if (btnCloseModal) {
      btnCloseModal.addEventListener("click", () => {
        this.hideResultModal();
      });
    }

    // Modal - Fechar ao clicar no overlay de fundo
    const resultModal = document.getElementById("result-modal");
    if (resultModal) {
      resultModal.addEventListener("click", (e) => {
        if (e.target === resultModal) {
          this.hideResultModal();
        }
      });
    }

    // Modal - Gerar Relatório
    const btnSaveReport = document.getElementById("modal-btn-save-report");
    const usernameInput = document.getElementById("modal-username");
    if (btnSaveReport) {
      btnSaveReport.addEventListener("click", () => {
        let username = usernameInput ? usernameInput.value.trim() : "";
        if (!username) username = "Anônimo";

        this.hideResultModal();
        if (this._modalPendingPayload) {
          this._modalPendingPayload.username = username;
          this.submitRunToBackend(this._modalPendingPayload);
        }
      });
    }

    if (usernameInput && btnSaveReport) {
      usernameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          btnSaveReport.click();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideResultModal();
      }
    });



    // Quiz
    document.querySelectorAll(".quiz-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const feedback = document.getElementById("quiz-feedback");
        if (e.target.dataset.correct === "true") {
          feedback.innerHTML =
            "<span style='color:#04A777;'>Correto! O termo Derivativo (Kd) prevê o erro futuro e amortece oscilações rápidas.</span>";
        } else {
          feedback.innerHTML =
            "<span style='color:#FF4444;'>Incorreto. Tente novamente! Lembre-se: qual termo lida com a velocidade de variação?</span>";
        }
      });
    });

    // Tutorial
    if (!localStorage.getItem("pid_tutorial_done")) {
      this.showOnboarding();
    }

    // Botões de Relevo da Pista (Fase 1)
    document.querySelectorAll(".btn-terrain").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-terrain").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const mode = btn.dataset.terrain;
        if (window.Scene3D && window.Scene3D.setTerrainMode) {
          window.Scene3D.setTerrainMode(mode);
        }
        if (window.SIM_STATE) {
          window.SIM_STATE.terrainMode = mode;
        }
      });
    });

    // Toggles de Telemetria Didática (Chart.js)
    const toggleMap = [
      { id: "chk-pv", index: 0 },
      { id: "chk-sp", index: 1 },
      { id: "chk-p", index: 2 },
      { id: "chk-i", index: 3 },
      { id: "chk-d", index: 4 },
      { id: "chk-theory", index: 5 }
    ];
    toggleMap.forEach(({ id, index }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", (e) => {
          if (window.ChartAnalytics && window.ChartAnalytics.toggleDataset) {
            window.ChartAnalytics.toggleDataset(index, e.target.checked);
          }
        });
      }
    });

    // Interruptor Interativo de Anti-Windup (Clamping vs Windup Real)
    const btnAntiWindup = document.getElementById("btn-toggle-antiwindup");
    const chkAntiWindupChart = document.getElementById("chk-antiwindup-chart");

    const iconShield = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    const iconAlert = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

    const updateAntiWindupUI = (enabled) => {
      window.SIM_STATE.enableAntiWindup = enabled;
      if (btnAntiWindup) {
        if (enabled) {
          btnAntiWindup.innerHTML = `${iconShield}<span>Anti-Windup: ON</span>`;
          btnAntiWindup.style.background = "rgba(0, 230, 118, 0.15)";
          btnAntiWindup.style.borderColor = "#00E676";
          btnAntiWindup.style.color = "#00E676";
          btnAntiWindup.title = "Anti-Windup ATIVO (Clamping limita a integral para evitar sobressinal). Clique para desligar e ver o Integrator Windup.";
        } else {
          btnAntiWindup.innerHTML = `${iconAlert}<span>Anti-Windup: OFF</span>`;
          btnAntiWindup.style.background = "rgba(239, 68, 68, 0.2)";
          btnAntiWindup.style.borderColor = "#EF4444";
          btnAntiWindup.style.color = "#EF4444";
          btnAntiWindup.title = "Anti-Windup DESATIVADO (Integral acumula livremente sob saturação -> causa overshoot maciço). Clique para reativar o Clamping.";
        }
      }
      if (chkAntiWindupChart) {
        chkAntiWindupChart.checked = enabled;
        const span = chkAntiWindupChart.parentElement.querySelector("span");
        if (span) {
          span.style.color = enabled ? "#00E676" : "#EF4444";
          span.textContent = enabled ? "Anti-Windup" : "Anti-Windup (OFF)";
        }
      }
      const chkAntiWindupFlt = document.getElementById("chk-antiwindup-flt");
      if (chkAntiWindupFlt) {
        chkAntiWindupFlt.checked = enabled;
        const spanFlt = chkAntiWindupFlt.parentElement.querySelector("span");
        if (spanFlt) {
          spanFlt.style.color = enabled ? "#00E676" : "#EF4444";
          spanFlt.textContent = enabled ? "Anti-Windup" : "Anti-Windup (OFF)";
        }
      }
    };

    if (btnAntiWindup) {
      btnAntiWindup.addEventListener("click", () => {
        const nextState = !window.SIM_STATE.enableAntiWindup;
        updateAntiWindupUI(nextState);
      });
    }

    if (chkAntiWindupChart) {
      chkAntiWindupChart.addEventListener("change", (e) => {
        updateAntiWindupUI(e.target.checked);
      });
    }

    // Inicializa histórico salvo no localStorage
    this.loadHistoryFromStorage();
  },

  loginUser: function (username) {
    if (!username) return;
    const clean = username.trim();
    if (!clean) return;

    if (window.SIM_STATE) {
      window.SIM_STATE.currentUser = clean;
    }
    const userDisplay = document.getElementById("user-display");
    const loginBtn = document.getElementById("login-btn");
    if (userDisplay) {
      userDisplay.textContent = `Olá, ${clean}`;
      userDisplay.style.display = "inline";
    }
    if (loginBtn) {
      loginBtn.style.display = "none";
    }
  },

  showOnboarding: function () {
    const modal = document.getElementById("tutorial-modal");
    const title = document.getElementById("tutorial-title");
    const text = document.getElementById("tutorial-text");
    const nextBtn = document.getElementById("tutorial-next-btn");
    if (!modal) return;

    const steps = [
      {
        title: "Bem-vindo ao PID Simulator!",
        text: "Neste simulador, você aprenderá a sintonizar Controladores Proporcionais, Integrais e Derivativos (PID) resolvendo desafios físicos reais.",
      },
      {
        title: "O Editor de Código",
        text: "À esquerda, você verá um editor de código JavaScript. É aqui que você escreverá a lógica do seu controlador. Variáveis como <code>error</code>, <code>integral</code> e <code>derivative</code> já estão injetadas para você usar.",
      },
      {
        title: "A Simulação 3D",
        text: "À direita, a simulação responderá em tempo real ao seu código. Seu objetivo é fazer com que o sistema atinja a 'Meta' o mais rápido possível e de forma estável.",
      },
      {
        title: "Métricas e Gráficos",
        text: "Você pode observar o comportamento do sistema nos Gráficos e avaliar seu desempenho na aba de Métricas. Quanto melhores as métricas, maior sua pontuação!",
      },
      {
        title: "Vamos começar!",
        text: "Experimente rodar a primeira simulação (Carro na Pista) com os parâmetros padrão. Clique em 'Concluir' para fechar este tutorial e começar sua jornada.",
      },
    ];

    let currentStep = 0;

    const updateStep = () => {
      title.innerHTML = steps[currentStep].title;
      text.innerHTML = steps[currentStep].text;
      if (currentStep === steps.length - 1) {
        nextBtn.textContent = "Concluir";
      }
    };

    modal.style.display = "flex";
    updateStep();

    nextBtn.onclick = () => {
      currentStep++;
      if (currentStep >= steps.length) {
        modal.style.display = "none";
        localStorage.setItem("pid_tutorial_done", "true");
      } else {
        updateStep();
      }
    };
  },

  setPlayButtonState: function (isRunning) {
    const btn = document.getElementById("play-btn");
    if (btn) btn.innerText = isRunning ? "PAUSA" : "SIMULAR";
  },

  updateTelemetry: function (pos, vel, err, force) {
    const posEl = document.getElementById("stat-pos");
    const velEl = document.getElementById("stat-vel");
    const errEl = document.getElementById("stat-err");
    const forceEl = document.getElementById("stat-force");
    if (posEl) posEl.textContent = pos.toFixed(1);
    if (velEl) velEl.textContent = vel.toFixed(2);
    if (errEl) errEl.textContent = Math.abs(err).toFixed(1);
    if (forceEl) forceEl.textContent = force.toFixed(2);
  },

  updateDisturbance: function (disturbance) {
    const lvl = window.SIM_STATE ? window.SIM_STATE.currentLevel : 1;
    const terrainMode = (window.SIM_STATE && window.SIM_STATE.terrainMode) || (window.Scene3D && window.Scene3D.currentTerrainMode) || 'flat';
    const panel = document.getElementById("disturbance-panel");
    const valEl = document.getElementById("disturbance-value");
    const barEl = document.getElementById("disturbance-bar");
    const descEl = document.getElementById("disturbance-desc");

    if (!panel) return;

    // Mostra nas fases com perturbação externa ou quando em relevo não-plano
    const hasDisturbance = lvl >= 2 || (terrainMode !== 'flat' && Math.abs(disturbance) > 0.05);
    panel.style.display = hasDisturbance ? "block" : "none";
    if (!hasDisturbance) return;

    if (valEl) valEl.textContent = (disturbance >= 0 ? "+" : "") + disturbance.toFixed(1) + " N";

    // Barra visual de perturbação (-/+ centralizada)
    if (barEl) {
      const maxForce = (lvl === 1) ? 200 : (lvl === 2 ? 100 : 1500); // escala por fase/relevo
      const pct = Math.min(100, (Math.abs(disturbance) / maxForce) * 100);
      barEl.style.width = pct + "%";
      barEl.style.background =
        Math.abs(disturbance) > maxForce * 0.6 ? "#ff4444" : "#FFB703";
      barEl.style.marginLeft = disturbance < 0 ? "auto" : "0";
    }

    if (descEl) {
      if (lvl === 1) {
        const abs = Math.abs(disturbance);
        if (abs < 5) descEl.textContent = "Pista nivelada";
        else if (disturbance < 0) descEl.textContent = "Força gravitacional de aclive (resistência)";
        else descEl.textContent = "Força gravitacional de declive (aceleração)";
      } else if (lvl === 2) {
        const abs = Math.abs(disturbance);
        if (abs < 5) descEl.textContent = "Vento calmo";
        else if (abs < 30) descEl.textContent = "Vento moderado";
        else if (abs < 60) descEl.textContent = "Rajada forte!";
        else descEl.textContent = "Tempestade!";
      } else if (lvl === 3) {
        const abs = Math.abs(disturbance);
        if (abs < 200) descEl.textContent = "Corrente suave";
        else if (abs < 600) descEl.textContent = "Corrente moderada";
        else descEl.textContent = "Corrente intensa!";
      }
    }
  },

  showError: function (msg) {
    const errBox = document.getElementById("code-error");
    if (errBox) {
      errBox.innerText = "Erro na Malha:\n" + msg;
      errBox.style.display = "block";
    }
  },

  hideError: function () {
    const errBox = document.getElementById("code-error");
    if (errBox) errBox.style.display = "none";
  },

  updateMetrics: function (
    riseTime,
    overshoot,
    settlingTime,
    error,
    vel,
    iae,
    ise,
    itae,
  ) {
    const riseEl = document.getElementById("rise-time");
    const overEl = document.getElementById("overshoot");
    const errEl = document.getElementById("final-error");
    const settleEl = document.getElementById("settling-time");

    const iaeEl = document.getElementById("metric-iae");
    const iseEl = document.getElementById("metric-ise");
    const itaeEl = document.getElementById("metric-itae");

    if (riseEl)
      riseEl.textContent = riseTime ? riseTime.toFixed(2) + "s" : "--";
    if (overEl) overEl.textContent = overshoot.toFixed(1) + "%";
    if (errEl) errEl.textContent = Math.abs(error).toFixed(2) + " u";

    const tol = Math.max(window.SIM_STATE.setPoint * 0.04, 1);
    if (settleEl) {
      if (riseTime && Math.abs(vel) < 0.5 && Math.abs(error) <= tol) {
        settleEl.textContent = settlingTime.toFixed(2) + "s";
      } else {
        settleEl.textContent = "Pendente...";
      }
    }

    if (iaeEl && iae !== undefined) iaeEl.textContent = iae.toFixed(2);
    if (iseEl && ise !== undefined) iseEl.textContent = ise.toFixed(2);
    if (itaeEl && itae !== undefined) itaeEl.textContent = itae.toFixed(2);
  },

  updateHistoryUI: function () {
    const historyBody = document.getElementById("history-body");
    if (!historyBody) return;
    historyBody.innerHTML = "";

    const runs = window.SIM_STATE.runHistory || [];
    if (runs.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="9" style="text-align: center; color: #94A3B8; padding: 24px;">Nenhuma simulação registrada ainda. Execute uma rodada para ver os resultados.</td>`;
      historyBody.appendChild(emptyRow);
      return;
    }

    runs.forEach((run) => {
      const row = document.createElement("tr");
      const riseTimeText = run.riseTime ? Number(run.riseTime).toFixed(2) + "s" : "--";
      const overshootText = (run.overshoot !== undefined && run.overshoot !== null)
        ? Number(run.overshoot).toFixed(1) + "%"
        : "--";
      const settlingTimeText = run.settlingTime ? Number(run.settlingTime).toFixed(2) + "s" : "--";
      const finalErrorText = (run.finalError !== undefined && run.finalError !== null)
        ? Math.abs(Number(run.finalError)).toFixed(2)
        : "--";

      const scoreText = (run.score !== undefined && run.score !== null)
        ? `<strong>${Number(run.score).toFixed(1)}</strong>`
        : "--";

      const actionHtml = `
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="btn-download-pdf" data-run-id="${run.id}" style="background: none; border: 1px solid rgba(0, 168, 150, 0.4); border-radius: 4px; padding: 3px 8px; cursor: pointer; color: var(--accent, #00A896); font-weight: 600; font-size: 0.85em; display: inline-flex; align-items: center; gap: 4px;" title="Baixar Laudo Técnico PDF">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF
          </button>
          <button type="button" class="btn-download-csv" data-run-id="${run.id}" style="background: none; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 3px 8px; cursor: pointer; color: #CBD5E1; font-weight: 600; font-size: 0.85em; display: inline-flex; align-items: center; gap: 4px;" title="Exportar CSV da Rodada">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV
          </button>
        </div>
      `;

      row.innerHTML = `
        <td><input type="radio" name="export_run_id" value="${run.id}" style="cursor: pointer;"></td>
        <td><strong>Run #${run.id}</strong></td>
        <td><span class="run-level-badge">${run.level || "Fase 1"}</span></td>
        <td>${riseTimeText}</td>
        <td>${overshootText}</td>
        <td>${settlingTimeText}</td>
        <td>${finalErrorText}</td>
        <td>${scoreText}</td>
        <td>${actionHtml}</td>
      `;
      historyBody.appendChild(row);
    });

    historyBody.querySelectorAll(".btn-download-pdf").forEach((btn) => {
      btn.onclick = () => {
        const runId = btn.getAttribute("data-run-id");
        this.downloadRunPDF(runId);
      };
    });

    historyBody.querySelectorAll(".btn-download-csv").forEach((btn) => {
      btn.onclick = () => {
        const runId = btn.getAttribute("data-run-id");
        this.downloadRunCSV(runId);
      };
    });
  },

  loadHistoryFromStorage: function () {
    try {
      const stored = localStorage.getItem("pid_simulator_run_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          window.SIM_STATE.runHistory = parsed;
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar histórico do localStorage:", e);
      window.SIM_STATE.runHistory = [];
    }
    this.updateHistoryUI();
  },

  saveRunToStorage: function (payload, score, runId) {
    const finalScore = score !== undefined && score !== null
      ? score
      : (this._calculateScore ? this._calculateScore(payload) : 100.0);

    const calculatedId = runId || ((window.SIM_STATE.runHistory ? window.SIM_STATE.runHistory.length : 0) + 1);

    const runData = {
      id: calculatedId,
      score: finalScore,
      username: payload.username || (window.SIM_STATE && window.SIM_STATE.currentUser) || "Anônimo",
      level: payload.level_name,
      riseTime: payload.rise_time,
      overshoot: payload.overshoot,
      settlingTime: payload.settling_time,
      finalError: payload.final_error,
      iae: payload.iae,
      ise: payload.ise,
      itae: payload.itae,
      codeSnippet: payload.code_snippet,
      timeSeries: payload.time_series || [],
      prevTimeSeries: payload.prev_time_series || null,
      date: new Date().toISOString()
    };

    if (!window.SIM_STATE.runHistory) {
      window.SIM_STATE.runHistory = [];
    }
    window.SIM_STATE.runHistory.push(runData);

    try {
      // Limita aos 50 registros mais recentes para economizar espaço
      const historyToSave = window.SIM_STATE.runHistory.slice(-50);
      localStorage.setItem("pid_simulator_run_history", JSON.stringify(historyToSave));
    } catch (e) {
      console.warn("Falha ao salvar histórico no localStorage:", e);
    }

    this.updateHistoryUI();
  },

  clearHistory: function () {
    if (confirm("Deseja realmente limpar todo o histórico de simulações salvo no seu navegador?")) {
      window.SIM_STATE.runHistory = [];
      localStorage.removeItem("pid_simulator_run_history");
      this.updateHistoryUI();
    }
  },

  downloadRunPDF: async function (runId) {
    const run = (window.SIM_STATE.runHistory || []).find((r) => String(r.id) === String(runId));
    if (!run) {
      alert("Rodada não encontrada no histórico.");
      return;
    }

    const payload = {
      run_id: run.id,
      username: run.username || (window.SIM_STATE && window.SIM_STATE.currentUser) || "Anônimo",
      level_name: run.level || "Carro na Pista 3D",
      rise_time: run.riseTime,
      overshoot: run.overshoot,
      settling_time: run.settlingTime,
      final_error: run.finalError,
      iae: run.iae,
      ise: run.ise,
      itae: run.itae,
      code_snippet: run.codeSnippet || "",
      time_series: run.timeSeries || [],
      prev_time_series: run.prevTimeSeries || null,
      score: run.score,
      created_at: run.date || new Date().toISOString()
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/runs/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Erro ao gerar relatório no backend.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_run_${run.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Falha ao baixar PDF:", err);
      alert("Não foi possível gerar o PDF. Verifique se o backend está ativo.");
    }
  },

  downloadRunCSV: function (runId) {
    const run = (window.SIM_STATE.runHistory || []).find((r) => String(r.id) === String(runId));
    if (!run || !run.timeSeries || run.timeSeries.length === 0) {
      alert("Telemetria temporal não disponível para esta rodada.");
      return;
    }
    this.exportTimeSeriesToCSV(run.timeSeries, `run_${run.id}_telemetria.csv`);
  },

  exportTimeSeriesToCSV: function (timeSeries, filename) {
    const headers = [
      "time_s", "position_y", "setpoint_r", "error_e", "force_u", "u_p", "u_i", "u_d", "disturbance"
    ];
    const rows = timeSeries.map((pt) => [
      (pt.time || 0).toFixed(3),
      (pt.position || 0).toFixed(3),
      (pt.setpoint || 0).toFixed(3),
      (pt.error || 0).toFixed(3),
      (pt.force || 0).toFixed(3),
      (pt.u_p || 0).toFixed(3),
      (pt.u_i || 0).toFixed(3),
      (pt.u_d || 0).toFixed(3),
      (pt.disturbance || 0).toFixed(3)
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename || "telemetria.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  _modalPendingPayload: null,

  _calculateScore: function (payload) {
    const sp = Math.abs(window.SIM_STATE ? window.SIM_STATE.setPoint : 600) || 600;
    // Limiares físicos compatíveis com o TCC (para 600m: maxRise=7.0s, maxSettle=15.0s)
    const maxRise = Math.max(3.0, 0.01 * sp + 1.0);
    const maxSettle = Math.max(5.0, 0.02 * sp + 3.0);

    let score = 100.0;

    // 1. Dedução de Erro Final
    if (payload.final_error !== undefined && payload.final_error !== null) {
      score -= Math.abs(payload.final_error) * 6.0;
    }

    // 2. Dedução de Overshoot (tolerância de 5% para o carro)
    if (payload.overshoot > 5.0) {
      score -= (payload.overshoot - 5.0) * 1.5;
    }

    // 3. Dedução de Tempo de Subida
    if (payload.rise_time !== null && payload.rise_time !== undefined) {
      if (payload.rise_time > maxRise) {
        score -= (payload.rise_time - maxRise) * 2.0;
      }
    } else {
      score -= 30.0;
    }

    // 4. Dedução de Tempo de Acomodação
    if (payload.settling_time !== null && payload.settling_time !== undefined) {
      if (payload.settling_time > maxSettle) {
        score -= (payload.settling_time - maxSettle) * 2.5;
      }
    } else {
      score -= 40.0;
    }

    return Math.max(0.0, Math.min(100.0, Math.round(score * 10) / 10));
  },

  showResultModal: function (payload) {
    this._modalPendingPayload = payload;
    const modal = document.getElementById("result-modal");
    if (modal) {
      modal.style.display = "flex";

      // Preenche o nome se já estiver logado
      const usernameInput = document.getElementById("modal-username");
      if (usernameInput) {
        if (window.SIM_STATE && window.SIM_STATE.currentUser) {
          usernameInput.value = window.SIM_STATE.currentUser;
        }
        setTimeout(() => usernameInput.focus(), 80);
      }
    }
  },

  hideResultModal: function () {
    const modal = document.getElementById("result-modal");
    if (modal) modal.style.display = "none";
  },

  saveRunLocal: function (payload) {
    this.saveRunToStorage(payload);
  },

  submitRunToBackend: async function (payload) {
    const nextRunId = ((window.SIM_STATE && window.SIM_STATE.runHistory) ? window.SIM_STATE.runHistory.length : 0) + 1;
    payload.run_id = nextRunId;

    // Busca a última rodada no histórico para o mesmo nível para fornecer a curva de comparação no PDF
    const prevRun = (window.SIM_STATE.runHistory || [])
      .slice()
      .reverse()
      .find((r) => r.level === payload.level_name && r.timeSeries && r.timeSeries.length > 0);
    if (prevRun) {
      payload.prev_time_series = prevRun.timeSeries;
    }

    const localScore = this._calculateScore ? this._calculateScore(payload) : 100.0;
    payload.score = localScore;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/runs/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erro ao gerar relatório no backend.");

      // Score calibrado retornado no cabeçalho pelo backend
      const serverScoreHeader = res.headers.get("X-Run-Score");
      const finalScore = serverScoreHeader ? parseFloat(serverScoreHeader) : localScore;

      // Dispara o download automático do PDF sem descarregar a página
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = `relatorio_run_${nextRunId}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(blobUrl);

      // Salva rodada no histórico do localStorage
      this.saveRunToStorage(payload, finalScore, nextRunId);
    } catch (err) {
      console.warn("Backend indisponível para gerar PDF:", err);
      alert(
        "A simulação foi concluída e salva no seu histórico local! (O servidor de geração de PDF não respondeu neste momento).",
      );
      this.saveRunToStorage(payload, localScore, nextRunId);
    }
  },

  updateLeaderboardUI: function () {
    // Leaderboard desativado
  },
};
