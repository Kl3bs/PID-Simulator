/*
    MÓDULO DE INTERFACE DO USUÁRIO (UI)
    Responsável por todos os inputs (botões, sliders) e outputs (telemetria, métricas).
    Suporta múltiplas fases com labels dinâmicas e painel de perturbação.
*/

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

    // Troca de abas
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".tab-content")
          .forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(tabName).classList.add("active");
        if (
          tabName === "chart" &&
          window.ChartAnalytics &&
          window.ChartAnalytics.chart
        ) {
          setTimeout(() => window.ChartAnalytics.chart.resize(), 100);
        }
      });
    });

    // Botão Simular / Pausa
    document.getElementById("play-btn").addEventListener("click", () => {
      if (!window.SIM_STATE.isRunning) {
        window.SIM_STATE.isRunning = true;
        window.SIM_STATE.lastTime = 0;
        window.SIM_STATE.lastError =
          window.SIM_STATE.setPoint - window.SIM_STATE.position;
        this.setPlayButtonState(true);
        PhysicsEngine.animationId = requestAnimationFrame(PhysicsEngine.loop);
      } else {
        window.SIM_STATE.isRunning = false;
        this.setPlayButtonState(false);
        cancelAnimationFrame(PhysicsEngine.animationId);
      }
    });

    // Botão Reset
    document.getElementById("reset-btn").addEventListener("click", () => {
      window.SIM_STATE.isRunning = false;
      cancelAnimationFrame(PhysicsEngine.animationId);
      this.setPlayButtonState(false);

      PhysicsEngine.reset();

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
        const selectedRadio = document.querySelector('input[name="export_run_id"]:checked');
        let runIdParam = "";
        if (selectedRadio) {
          if (String(selectedRadio.value).startsWith("local_")) {
            alert("Não é possível exportar rodadas locais não salvas no banco de dados.");
            return;
          }
          runIdParam = `&run_id=${selectedRadio.value}`;
        }

        let username = null;
        if (window.SIM_STATE && window.SIM_STATE.currentUser) {
          username = window.SIM_STATE.currentUser;
        } else {
          username = prompt(
            "Digite seu username para exportar seu histórico (deixe em branco para exportar todos" + (selectedRadio ? ", a run selecionada será filtrada" : "") + "):",
            "",
          );
        }

        if (username !== null) {
          let url = "http://localhost:8081/api/v1/runs/export";
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

    // Modal - Salvar Localmente
    const btnSaveOnly = document.getElementById("modal-btn-save-only");
    if (btnSaveOnly) {
      btnSaveOnly.addEventListener("click", () => {
        this.hideResultModal();
        if (this._modalPendingPayload) {
          this.saveRunLocal(this._modalPendingPayload);
        }
      });
    }

    // Modal - Salvar e Gerar Relatório
    const btnSaveReport = document.getElementById("modal-btn-save-report");
    if (btnSaveReport) {
      btnSaveReport.addEventListener("click", () => {
        const usernameInput = document.getElementById("modal-username");
        let username = usernameInput ? usernameInput.value.trim() : "";
        if (!username) username = "Anônimo";

        this.hideResultModal();
        if (this._modalPendingPayload) {
          this._modalPendingPayload.username = username;
          this.submitRunToBackend(this._modalPendingPayload);
        }
      });
    }

    // Inicializa Leaderboard
    this.updateLeaderboardUI();

    // Login/Historico Button
    const loginBtn = document.getElementById("login-btn");
    const loginModal = document.getElementById("login-modal");
    const loginConfirmBtn = document.getElementById("login-confirm-btn");
    const loginCancelBtn = document.getElementById("login-cancel-btn");
    const loginInput = document.getElementById("login-username-input");

    if (loginBtn && loginModal) {
      loginBtn.addEventListener("click", () => {
        loginModal.style.display = "flex";
        if (loginInput) loginInput.focus();
      });

      if (loginCancelBtn) {
        loginCancelBtn.addEventListener("click", () => {
          loginModal.style.display = "none";
        });
      }

      if (loginConfirmBtn && loginInput) {
        loginConfirmBtn.addEventListener("click", () => {
          const username = loginInput.value;
          if (username && username.trim() !== "") {
            this.loginUser(username.trim());
            loginModal.style.display = "none";
          }
        });
        // Permitir 'Enter' no input
        loginInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            loginConfirmBtn.click();
          }
        });
      }
    }

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
  },

  loginUser: function (username) {
    fetch(
      `http://localhost:8081/api/v1/runs/?username=${encodeURIComponent(username)}`,
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
        title: "Bem-vindo ao PID Simulator! 🎓",
        text: "Neste simulador, você aprenderá a sintonizar Controladores Proporcionais, Integrais e Derivativos (PID) resolvendo desafios físicos reais.",
      },
      {
        title: "O Editor de Código 💻",
        text: "À esquerda, você verá um editor de código JavaScript. É aqui que você escreverá a lógica do seu controlador. Variáveis como <code>error</code>, <code>integral</code> e <code>derivative</code> já estão injetadas para você usar.",
      },
      {
        title: "A Simulação 3D 🚀",
        text: "À direita, a simulação responderá em tempo real ao seu código. Seu objetivo é fazer com que o sistema atinja a 'Meta' o mais rápido possível e de forma estável.",
      },
      {
        title: "Métricas e Gráficos 📊",
        text: "Você pode observar o comportamento do sistema nos Gráficos e avaliar seu desempenho na aba de Métricas. Quanto melhores as métricas, maior sua pontuação!",
      },
      {
        title: "Vamos começar! 🏁",
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
    const panel = document.getElementById("disturbance-panel");
    const valEl = document.getElementById("disturbance-value");
    const barEl = document.getElementById("disturbance-bar");
    const descEl = document.getElementById("disturbance-desc");

    if (!panel) return;

    // Só mostra nas fases com perturbação
    panel.style.display = lvl >= 2 ? "block" : "none";
    if (lvl < 2) return;

    if (valEl) valEl.textContent = disturbance.toFixed(1) + " N";

    // Barra visual de perturbação (-/+ centralizada)
    if (barEl) {
      const maxForce = lvl === 2 ? 100 : 1500; // escala por fase
      const pct = Math.min(100, (Math.abs(disturbance) / maxForce) * 100);
      barEl.style.width = pct + "%";
      barEl.style.background =
        Math.abs(disturbance) > maxForce * 0.6 ? "#ff4444" : "#FFB703";
      barEl.style.marginLeft = disturbance < 0 ? "auto" : "0";
    }

    if (descEl) {
      if (lvl === 2) {
        const abs = Math.abs(disturbance);
        if (abs < 5) descEl.textContent = "🌤 Vento calmo";
        else if (abs < 30) descEl.textContent = "💨 Vento moderado";
        else if (abs < 60) descEl.textContent = "🌬 Rajada forte!";
        else descEl.textContent = "🌪 Tempestade!";
      } else if (lvl === 3) {
        const abs = Math.abs(disturbance);
        if (abs < 200) descEl.textContent = "🌊 Corrente suave";
        else if (abs < 600) descEl.textContent = "🌊🌊 Corrente moderada";
        else descEl.textContent = "🌊🌊🌊 Corrente intensa!";
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

  updateMetrics: function (riseTime, overshoot, settlingTime, error, vel, iae, ise, itae) {
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
      const row = document.createElement("tr");
      const riseTimeText = run.riseTime ? run.riseTime.toFixed(2) + "s" : "--";
      const overshootText = run.overshoot.toFixed(1) + "%";
      const settlingTimeText = run.settlingTime.toFixed(2) + "s";
      const finalErrorText = Math.abs(run.finalError).toFixed(2);

      const isLocal = typeof run.id === "string" && run.id.startsWith("local_");
      const scoreText = isLocal
        ? "--"
        : `<strong>${run.score.toFixed(1)}</strong>`;

      const actionHtml = isLocal
        ? '<span style="color: #94a3b8; font-size: 0.9em;">Indisponível (Local)</span>'
        : `<a href="http://localhost:8081/api/v1/runs/${run.id}/report" class="btn-download" style="color: #1a6e8a; font-weight: bold; text-decoration: underline;" download> Baixar PDF</a>`;

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

  showResultModal: function (payload) {
    this._modalPendingPayload = payload;
    const modal = document.getElementById("result-modal");
    if (modal) {
      modal.style.display = "flex";

      // Simular o cálculo do score localmente para exibir uma prévia no modal
      let simulatedScore = 100;
      if (payload.overshoot > 5) simulatedScore -= payload.overshoot * 0.5;
      if (payload.settling_time > 5)
        simulatedScore -= payload.settling_time * 2;
      simulatedScore = Math.max(0, Math.min(100, simulatedScore));

      const scoreEl = document.getElementById("modal-score-value");
      if (scoreEl) scoreEl.innerText = simulatedScore.toFixed(1) + "/100";

      // Pre-fill username if logged in
      if (window.SIM_STATE && window.SIM_STATE.currentUser) {
        const usernameInput = document.getElementById("modal-username");
        if (usernameInput) {
          usernameInput.value = window.SIM_STATE.currentUser;
        }
      }

      // Verifica Desafio
      let challengeMsg = "";
      const lvlObj =
        window.LevelManager && window.SIM_STATE
          ? window.LevelManager.levels[window.SIM_STATE.currentLevel]
          : null;
      if (lvlObj && lvlObj.challenge) {
        const passed = lvlObj.challenge.check(payload);
        if (passed) {
          challengeMsg =
            "<div style='color:#04A777; font-weight:bold; margin-top:10px; font-size:1.1em;'>🏅 " +
            lvlObj.challenge.text +
            " CONCLUÍDO!</div>";
        } else {
          challengeMsg =
            "<div style='color:#FFB703; margin-top:10px;'>❌ Desafio não atingido desta vez. Tente novamente!</div>";
        }
      }

      // Injetar a msg do desafio antes do texto
      let textEl = modal.querySelector(".modal-text");
      let existingChallengeMsg = document.getElementById("modal-challenge-msg");
      if (existingChallengeMsg) existingChallengeMsg.remove();

      if (challengeMsg && textEl) {
        const div = document.createElement("div");
        div.id = "modal-challenge-msg";
        div.innerHTML = challengeMsg;
        div.style.marginBottom = "15px";
        textEl.parentNode.insertBefore(div, textEl);
      }
    }
  },

  hideResultModal: function () {
    const modal = document.getElementById("result-modal");
    if (modal) modal.style.display = "none";
  },

  saveRunLocal: function (payload) {
    const runData = {
      id: `local_${window.SIM_STATE.runHistory.length + 1}`,
      score: 0,
      level: payload.level_name,
      riseTime: payload.rise_time,
      overshoot: payload.overshoot,
      settlingTime: payload.settling_time,
      finalError: payload.final_error,
      codeSnippet: payload.code_snippet,
    };
    window.SIM_STATE.runHistory.push(runData);
    this.updateHistoryUI();
  },

  submitRunToBackend: function (payload) {
    fetch("http://localhost:8081/api/v1/runs/", {
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
        };
        window.SIM_STATE.runHistory.push(runData);
        this.updateHistoryUI();
        this.updateLeaderboardUI();

        // Dispara o download automático do PDF
        window.location.href = `http://localhost:8081/api/v1/runs/${data.id}/report`;
      })
      .catch((err) => {
        console.error(err);
        alert(
          "Falha na conexão com o backend. A rodada será salva localmente.",
        );
        this.saveRunLocal(payload);
      });
  },

  updateLeaderboardUI: function () {
    fetch("http://localhost:8081/api/v1/runs/leaderboard")
      .then((res) => {
        if (!res.ok) throw new Error("Leaderboard falhou");
        return res.json();
      })
      .then((data) => {
        const lbBody = document.getElementById("leaderboard-body");
        if (!lbBody) return;
        lbBody.innerHTML = "";

        data.forEach((entry, index) => {
          const row = document.createElement("tr");
          let posMedal = `${index + 1}º`;
          if (index === 0) posMedal = "🥇 1º";
          if (index === 1) posMedal = "🥈 2º";
          if (index === 2) posMedal = "🥉 3º";

          const dateStr = new Date(entry.created_at).toLocaleDateString(
            "pt-BR",
          );

          row.innerHTML = `
                <td><strong>${posMedal}</strong></td>
                <td>${entry.username}</td>
                <td><span class="run-level-badge">${entry.level_name}</span></td>
                <td><strong>${entry.score.toFixed(1)}</strong></td>
                <td>${dateStr}</td>
            `;
          lbBody.appendChild(row);
        });
      })
      .catch((err) => console.error("Erro ao carregar leaderboard:", err));
  },
};
