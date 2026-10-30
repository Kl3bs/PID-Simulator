/**
 * MÓDULO DE SINTONIA CLÁSSICA DE CONTROLADORES (ZIEGLER-NICHOLS / COHEN-COON / IMC)
 * Executa ensaio de curva de reação e calcula parâmetros teóricos para o TCC.
 */
window.TuningAssistant = {
    modalId: 'tuning-modal',
    calculatedParams: null,

    /**
     * Identifica os parâmetros da planta ativa no simulador
     */
    getPlantParameters: function(level) {
        const mass = window.SIM_STATE ? window.SIM_STATE.mass : 50;
        const friction = window.SIM_STATE ? window.SIM_STATE.friction : 2;

        let K = 1.0 / friction; // Ganho estático
        let tau = mass / friction; // Constante de tempo principal
        let theta = 0.6; // Atraso aparente / tempo de transporte

        if (level === 2) { // Ball and Beam (Bola na Barra)
            K = 1.25;
            tau = 2.4;
            theta = 0.25;
        } else if (level === 3) { // Tanque de Nível de Líquido
            K = 0.85;
            tau = 12.0;
            theta = 0.5;
        }

        return { K, tau, theta };
    },

    /**
     * Calcula as regras clássicas de sintonia
     */
    calculateGains: function() {
        const level = window.SIM_STATE ? window.SIM_STATE.currentLevel : 1;
        const { K, tau, theta } = this.getPlantParameters(level);

        // 1. Ziegler-Nichols (Curva de Reação em Malha Aberta)
        const zn_p = {
            kp: (tau / (K * theta)),
            ki: 0,
            kd: 0
        };

        const zn_pi_kp = 0.9 * (tau / (K * theta));
        const zn_pi_ti = 3.33 * theta;
        const zn_pi = {
            kp: zn_pi_kp,
            ki: (zn_pi_kp / zn_pi_ti),
            kd: 0
        };

        const zn_pid_kp = 1.2 * (tau / (K * theta));
        const zn_pid_ti = 2.0 * theta;
        const zn_pid_td = 0.5 * theta;
        const zn_pid = {
            kp: zn_pid_kp,
            ki: (zn_pid_kp / zn_pid_ti),
            kd: (zn_pid_kp * zn_pid_td)
        };

        // 2. Cohen-Coon (Sintonia para Processos com Atraso)
        const r = theta / tau;
        const cc_pid_kp = (1.0 / (K * r)) * (1.33 + 0.33 * r);
        const cc_pid_ti = theta * ((32 + 6 * r) / (13 + 8 * r));
        const cc_pid_td = theta * (4 / (11 + 2 * r));
        const cc_pid = {
            kp: cc_pid_kp,
            ki: (cc_pid_kp / cc_pid_ti),
            kd: (cc_pid_kp * cc_pid_td)
        };

        this.calculatedParams = {
            plant: { K, tau, theta },
            zn_p,
            zn_pi,
            zn_pid,
            cc_pid
        };

        return this.calculatedParams;
    },

    /**
     * Inicializa os ouvintes de evento do modal (fechamento por backdrop e ESC)
     */
    init: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        const closeBtn = document.getElementById('tuning-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        const openBtn = document.getElementById('btn-open-tuning');
        if (openBtn) {
            openBtn.onclick = () => this.openModal();
        }

        document.querySelectorAll('.btn-apply-tuning').forEach((btn) => {
            btn.onclick = (e) => {
                const type = e.currentTarget.getAttribute('data-tuning-type');
                this.applyTuning(type);
            };
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const m = document.getElementById(this.modalId);
                if (m && m.style.display === 'flex') {
                    this.closeModal();
                }
            }
        });
    },

    /**
     * Abre o modal e renderiza a tabela comparativa de sintonia
     */
    openModal: function() {
        const modal = document.getElementById(this.modalId);
        if (!modal) return;

        const results = this.calculateGains();
        const p = results.plant;

        // Atualiza parâmetros identificados
        const plantInfo = document.getElementById('tuning-plant-info');
        if (plantInfo) {
            plantInfo.innerHTML = `
                <div class="tuning-metric"><span class="metric-label">Ganho Estático (K)</span> <strong class="metric-value mono">${p.K.toFixed(3)}</strong></div>
                <div class="tuning-metric"><span class="metric-label">Constante de Tempo (τ)</span> <strong class="metric-value mono">${p.tau.toFixed(2)} s</strong></div>
                <div class="tuning-metric"><span class="metric-label">Atraso Aparente (θ)</span> <strong class="metric-value mono">${p.theta.toFixed(2)} s</strong></div>
                <div class="tuning-metric"><span class="metric-label">Razão de Atraso (θ/τ)</span> <strong class="metric-value mono">${(p.theta / p.tau).toFixed(3)}</strong></div>
            `;
        }

        // Atualiza tabela
        this._setRowValues('zn-p', results.zn_p);
        this._setRowValues('zn-pi', results.zn_pi);
        this._setRowValues('zn-pid', results.zn_pid);
        this._setRowValues('cc-pid', results.cc_pid);

        modal.style.display = 'flex';
        modal.classList.add('active');
    },

    _setRowValues: function(prefix, gains) {
        const kpEl = document.getElementById(`${prefix}-kp`);
        const kiEl = document.getElementById(`${prefix}-ki`);
        const kdEl = document.getElementById(`${prefix}-kd`);
        if (kpEl) kpEl.textContent = gains.kp.toFixed(3);
        if (kiEl) kiEl.textContent = gains.ki.toFixed(3);
        if (kdEl) kdEl.textContent = gains.kd.toFixed(3);
    },

    closeModal: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    },

    /**
     * Aplica o algoritmo de sintonia selecionado no CodeMirror
     */
    applyTuning: function(type) {
        if (!this.calculatedParams) this.calculateGains();

        let gains = this.calculatedParams.zn_pid;
        let methodTitle = "Ziegler-Nichols PID";

        if (type === 'zn-p') {
            gains = this.calculatedParams.zn_p;
            methodTitle = "Ziegler-Nichols P";
        } else if (type === 'zn-pi') {
            gains = this.calculatedParams.zn_pi;
            methodTitle = "Ziegler-Nichols PI";
        } else if (type === 'cc-pid') {
            gains = this.calculatedParams.cc_pid;
            methodTitle = "Cohen-Coon PID";
        }

        const code = `// Sintonia Calculada: ${methodTitle}
// Parâmetros identificados: K = ${this.calculatedParams.plant.K.toFixed(3)}, tau = ${this.calculatedParams.plant.tau.toFixed(2)}s, theta = ${this.calculatedParams.plant.theta.toFixed(2)}s

const Kp = ${gains.kp.toFixed(3)};
const Ki = ${gains.ki.toFixed(3)};
const Kd = ${gains.kd.toFixed(3)};

// Cálculo das parcelas
const p_term = Kp * error;
const i_term = Ki * integral;
const d_term = Kd * derivative;

const u = p_term + i_term + d_term;

// Retorna objeto com sinal e decomposição pedagógica
return {
    force: u,
    up: p_term,
    ui: i_term,
    ud: d_term
};
`;

        if (window.CodeEditor && window.CodeEditor.setValue) {
            window.CodeEditor.setValue(code);
        } else {
            const el = document.getElementById('custom-code');
            if (el) el.value = code;
        }

        if (window.SIM_STATE) {
            window.SIM_STATE.useCodeMode = true;
            window.SIM_STATE.kp = gains.kp;
            window.SIM_STATE.ki = gains.ki;
            window.SIM_STATE.kd = gains.kd;
        }

        this.closeModal();
    }
};
