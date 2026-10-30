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

    // Modal - Exportar CSV
    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const selectedRadio = document.querySelector(
          'input[name="export_run_id"]:checked',
        );
        let runIdParam = "";
        if (selectedRadio) {
          if (String(selectedRadio.value).startsWith("local_")) {
            alert(
              "Não é possível exportar rodadas locais não salvas no banco de dados.",
            );
            return;
          }
          runIdParam = `&run_id=${selectedRadio.value}`;
        }

        let username = null;
        if (window.SIM_STATE && window.SIM_STATE.currentUser) {
          username = window.SIM_STATE.currentUser;
        } else {
          username = prompt(
            "Digite seu username para exportar seu histórico (deixe em branco para exportar todos" +
              (selectedRadio ? ", a run selecionada será filtrada" : "") +
              "):",
            "",
          );
        }

        if (username !== null) {
          let url = `${API_BASE_URL}/api/v1/runs/export`;
          let hasQuery = false;

          if (username.trim() !== "") {
            url += "?username=" + encodeURIComponent(username.trim());
            hasQuery = true;
          }
          if (selectedRadio) {
            url += (hasQuery ? "&" : "?") + "run_id=" + selectedRadio.value;
          }

          window.open(url, "_blank");
          if (selectedRadio) selectedRadio.checked = false;
        }
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
  },

  loginUser: function (username) {
    fetch(
      `${API_BASE_URL}/api/v1/runs/?username=${encodeURIComponent(username)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao buscar histórico");
        return res.json();
      })
      .then((data) => {
        window.SIM_STATE.runHistory = data.map((r) => ({
          id: r.id,
          score: r.score,
          level: r.level_name,
          riseTime: r.rise_time,
          overshoot: r.overshoot,
          settlingTime: r.settling_time,
          finalError: r.final_error,
          codeSnippet: r.code_snippet,
        }));
        this.updateHistoryUI();

        const userDisplay = document.getElementById("user-display");
        const loginBtn = document.getElementById("login-btn");
        if (userDisplay && loginBtn) {
          userDisplay.textContent = `Olá, ${username}`;
          userDisplay.style.display = "inline";
          loginBtn.style.display = "none";
        }
        if (window.SIM_STATE) {
          window.SIM_STATE.currentUser = username;
        }
      })
      .catch((err) => console.error("Falha no login", err));
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

    window.SIM_STATE.runHistory.forEach((run) => {
      const isLocal = Boolean(
        run.isLocal ||
        (typeof run.id === "string" && run.id.startsWith("local_"))
      );
      const row = document.createElement("tr");
      const riseTimeText = run.riseTime ? run.riseTime.toFixed(2) + "s" : "--";
      const overshootText = (run.overshoot !== undefined && run.overshoot !== null)
        ? run.overshoot.toFixed(1) + "%"
        : "--";
      const settlingTimeText = run.settlingTime ? run.settlingTime.toFixed(2) + "s" : "--";
      const finalErrorText = (run.finalError !== undefined && run.finalError !== null)
        ? Math.abs(run.finalError).toFixed(2)
        : "--";

      const scoreText = (run.score !== undefined && run.score !== null)
        ? `<strong>${Number(run.score).toFixed(1)}</strong>`
        : "--";

      const actionHtml = isLocal
        ? '<span style="color: #94a3b8; font-size: 0.9em;">Indisponível (Local)</span>'
        : `<div style="display: flex; gap: 8px; align-items: center;">
             <a href="${API_BASE_URL}/api/v1/runs/${run.id}/report" class="btn-download" style="color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; text-decoration: none;" download><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF</a>
             <a href="${API_BASE_URL}/api/v1/runs/${run.id}/export-csv" class="btn-download" style="color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; text-decoration: none;" download><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</a>
           </div>`;

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
    const calculatedScore = this._calculateScore ? this._calculateScore(payload) : 100.0;
    const runData = {
      id: `local_${window.SIM_STATE.runHistory.length + 1}`,
      score: calculatedScore,
      level: payload.level_name,
      riseTime: payload.rise_time,
      overshoot: payload.overshoot,
      settlingTime: payload.settling_time,
      finalError: payload.final_error,
      codeSnippet: payload.code_snippet,
      isLocal: true,
    };
    window.SIM_STATE.runHistory.push(runData);
    this.updateHistoryUI();
  },

  submitRunToBackend: function (payload) {
    fetch(`${API_BASE_URL}/api/v1/runs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao salvar simulação no backend.");
        return res.json();
      })
      .then((data) => {
        const runData = {
          id: data.id,
          score: data.score,
          level: payload.level_name,
          riseTime: payload.rise_time,
          overshoot: payload.overshoot,
          settlingTime: payload.settling_time,
          finalError: payload.final_error,
          codeSnippet: payload.code_snippet,
          isLocal: false,
        };
        window.SIM_STATE.runHistory.push(runData);
        this.updateHistoryUI();

        // Dispara o download automático do PDF sem descarregar a página
        const downloadLink = document.createElement("a");
        downloadLink.href = `${API_BASE_URL}/api/v1/runs/${data.id}/report`;
        downloadLink.download = `relatorio_run_${data.id}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      })
      .catch((err) => {
        console.error("Erro na comunicação com o backend:", err);
        alert(
          "Falha na conexão com o backend. A rodada será salva localmente.",
        );
        this.saveRunLocal(payload);
      });
  },

  updateLeaderboardUI: function () {
    // Leaderboard desativado
  },
};
