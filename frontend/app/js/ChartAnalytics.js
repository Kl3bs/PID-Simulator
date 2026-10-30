/**
 * MÓDULO DE TELEMETRIA E ANÁLISE GRÁFICA DIDÁTICA (AVANÇADO)
 * - Retenção de histórico completo (preserva a forma da curva ao longo do tempo)
 * - Seletor de horizonte temporal: 10s, 30s, 60s ou Completo (Todo o ensaio)
 * - Suporte a múltiplos alvos de renderização (Painel Ancorado + Janela Flutuante Redimensionável)
 * - Faixa de tolerância ±2% (critério de acomodação para controle)
 * - Decimação inteligente para renderização fluida a 60 FPS
 * - Exportação de dados para CSV e imagem PNG de alta resolução para TCC
 */
window.ChartAnalytics = {
    chart: null,                 // Gráfico principal ancorado
    floatingChart: null,         // Gráfico da janela flutuante
    lastUpdateTime: 0,
    timeWindowMode: 'full',      // '10', '30', '60' ou 'full' (padrão 'full' para não perder a curva)
    masterHistory: [],           // Buffer com todos os pontos do ensaio atual
    isPaused: false,             // Permite inspecionar a curva sem perda de dados
    showToleranceBand: true,     // Exibe faixa ±2% de acomodação em torno do setpoint
    
    // Configurações de cores alinhadas ao design system
    colors: {
        pv: '#00F2FE',           // Ciano vibrante
        sp: '#FF5252',           // Carmim tracejado
        p: '#FFB300',            // Âmbar
        i: '#00E676',            // Esmeralda
        d: '#E040FB',            // Roxo ultravioleta
        theory: '#94A3B8',       // Cinza azulado
        disturbance: '#EF4444',  // Vermelho
        bandLine: 'rgba(255, 82, 82, 0.4)',
        bandFill: 'rgba(255, 82, 82, 0.07)'
    },

    /**
     * Cria a configuração padrão do Chart.js com todas as camadas e estilos
     */
    _createConfig: function() {
        return {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Posição y(t)',
                        data: [],
                        borderColor: this.colors.pv,
                        backgroundColor: 'rgba(0, 242, 254, 0.05)',
                        borderWidth: 2.2,
                        yAxisID: 'y',
                        pointRadius: 0,
                        tension: 0.1,
                        order: 1
                    },
                    {
                        label: 'Setpoint r(t)',
                        data: [],
                        borderColor: this.colors.sp,
                        borderDash: [6, 4],
                        borderWidth: 2,
                        yAxisID: 'y',
                        pointRadius: 0,
                        order: 2
                    },
                    {
                        label: 'Ação P (u_p)',
                        data: [],
                        borderColor: this.colors.p,
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: false,
                        order: 5
                    },
                    {
                        label: 'Ação I (u_i)',
                        data: [],
                        borderColor: this.colors.i,
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: false,
                        order: 6
                    },
                    {
                        label: 'Ação D (u_d)',
                        data: [],
                        borderColor: this.colors.d,
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: false,
                        order: 7
                    },
                    {
                        label: 'Curva Teórica',
                        data: [],
                        borderColor: this.colors.theory,
                        borderDash: [3, 3],
                        borderWidth: 1.4,
                        yAxisID: 'y',
                        pointRadius: 0,
                        hidden: true,
                        order: 4
                    },
                    {
                        label: 'Perturbação',
                        data: [],
                        borderColor: this.colors.disturbance,
                        borderWidth: 1.2,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: true,
                        order: 8
                    },
                    {
                        label: 'Faixa +2%',
                        data: [],
                        borderColor: this.colors.bandLine,
                        borderDash: [2, 2],
                        borderWidth: 1,
                        yAxisID: 'y',
                        pointRadius: 0,
                        fill: false,
                        hidden: !this.showToleranceBand,
                        order: 3
                    },
                    {
                        label: 'Faixa -2%',
                        data: [],
                        borderColor: this.colors.bandLine,
                        borderDash: [2, 2],
                        borderWidth: 1,
                        backgroundColor: this.colors.bandFill,
                        fill: '-1', // Preenchimento entre Faixa +2% e -2%
                        yAxisID: 'y',
                        pointRadius: 0,
                        hidden: !this.showToleranceBand,
                        order: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94A3B8',
                            maxTicksLimit: 10,
                            font: { family: "'JetBrains Mono', monospace", size: 10 }
                        },
                        title: {
                            display: true,
                            text: 'Tempo (s)',
                            color: '#64748B',
                            font: { size: 10 }
                        }
                    },
                    y: {
                        title: { display: true, text: 'Posição / Referência (m)', color: '#94A3B8', font: { size: 11 } },
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#00F2FE',
                            font: { family: "'JetBrains Mono', monospace", size: 10 }
                        }
                    },
                    y1: {
                        title: { display: true, text: 'Esforço de Controle u(t) (N)', color: '#94A3B8', font: { size: 11 } },
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#FFB300',
                            font: { family: "'JetBrains Mono', monospace", size: 10 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Usamos a barra de controles dedicada
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 24, 38, 0.95)',
                        titleColor: '#00F2FE',
                        bodyColor: '#FFFFFF',
                        borderColor: 'rgba(249, 115, 22, 0.3)',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 4,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const val = context.parsed.y;
                                if (label.includes('Faixa')) return null; // Não polui tooltip
                                return `${label}: ${val !== null ? val.toFixed(2) : '--'}`;
                            }
                        }
                    }
                }
            }
        };
    },

    /**
     * Inicializa o gráfico principal (docked)
     */
    init: function(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.chart) {
            try { this.chart.destroy(); } catch (e) {}
        }

        this.chart = new Chart(ctx, this._createConfig());
    },

    /**
     * Inicializa ou re-vincula o gráfico da janela flutuante
     */
    initFloating: function(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.floatingChart) {
            try { this.floatingChart.destroy(); } catch (e) {}
        }

        this.floatingChart = new Chart(ctx, this._createConfig());

        // Replica o estado de visibilidade atual dos datasets para o gráfico flutuante
        if (this.chart) {
            this.chart.data.datasets.forEach((ds, i) => {
                if (this.floatingChart.data.datasets[i]) {
                    this.floatingChart.data.datasets[i].hidden = ds.hidden;
                }
            });
            this.refreshCharts();
        }
    },

    /**
     * Define o horizonte temporal ('10', '30', '60' ou 'full')
     */
    setTimeWindow: function(mode) {
        this.timeWindowMode = mode;
        this.refreshCharts();

        // Atualiza a classe ativa em todos os botões de janela de tempo
        document.querySelectorAll('.btn-time-window').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.window === mode);
        });
    },

    /**
     * Calcula resposta analítica aproximada de 2ª ordem para o setpoint atual
     */
    _calcTheoreticalResponse: function(t, setpoint) {
        if (t <= 0) return 0;
        const wn = 1.8;
        const zeta = 0.55;
        const wd = wn * Math.sqrt(Math.max(0.01, 1 - zeta * zeta));
        const envelope = Math.exp(-zeta * wn * t);
        const y = setpoint * (1 - envelope * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t)));
        return Math.max(0, y);
    },

    /**
     * Registra um novo ponto de telemetria da simulação física
     */
    tick: function(timestamp, position, setPoint, error, force, disturbance = 0, up = 0, ui = 0, ud = 0) {
        if (!this.chart && !this.floatingChart) return;

        // Limita a taxa de atualização gráfica a ~20Hz (50ms) para máxima fluidez
        if (timestamp - this.lastUpdateTime < 50) return;
        this.lastUpdateTime = timestamp;

        const t = (window.SIM_STATE && window.SIM_STATE.simTime !== undefined) ? window.SIM_STATE.simTime : 0;
        const theoreticalY = this._calcTheoreticalResponse(t, setPoint);

        // Faixa de tolerância de ±2% em torno do Setpoint (mínimo 0.1m de banda para estabilidade)
        const tolBandDelta = Math.max(Math.abs(setPoint) * 0.02, 0.1);
        const bandUpper = setPoint + tolBandDelta;
        const bandLower = setPoint - tolBandDelta;

        const record = {
            t: t,
            pos: position,
            sp: setPoint,
            up: up,
            ui: ui,
            ud: ud,
            theory: theoreticalY,
            dist: disturbance,
            bandUpper: bandUpper,
            bandLower: bandLower
        };

        // Salva no histórico mestre (NUNCA descartado durante a execução)
        this.masterHistory.push(record);

        // Se pausado pelo usuário para inspeção, não rola a tela automaticamente
        if (this.isPaused) return;

        this._renderCurrentSlice();
        this.updateRmseDisplay();
        this.updateFooterStats(record);
    },

    /**
     * Renderiza a fatia visível de acordo com o horizonte de tempo selecionado
     */
    _renderCurrentSlice: function() {
        if (!this.masterHistory.length) return;

        const totalPoints = this.masterHistory.length;
        const latestTime = this.masterHistory[totalPoints - 1].t;

        let visibleSlice;

        if (this.timeWindowMode === 'full') {
            // Modo Completo: preserva toda a trajetória do ensaio!
            // Se houver mais de 1200 pontos acumulados, aplica decimação MinMax inteligente
            if (totalPoints > 1200) {
                visibleSlice = this._decimateMinMax(this.masterHistory, 800);
            } else {
                visibleSlice = this.masterHistory;
            }
        } else {
            // Modos de janela rolante (10s, 30s, 60s)
            const windowSeconds = parseFloat(this.timeWindowMode) || 30;
            const startTime = Math.max(0, latestTime - windowSeconds);

            // Busca binária ou corte por filtro
            visibleSlice = this.masterHistory.filter(pt => pt.t >= startTime);

            // Garante que se a fatia ainda for grande, não ultrapasse limites
            if (visibleSlice.length > 800) {
                visibleSlice = this._decimateMinMax(visibleSlice, 600);
            }
        }

        // Prepara buffers de arrays
        const count = visibleSlice.length;
        const labels = new Array(count);
        const dPos = new Array(count);
        const dSp = new Array(count);
        const dUp = new Array(count);
        const dUi = new Array(count);
        const dUd = new Array(count);
        const dTheo = new Array(count);
        const dDist = new Array(count);
        const dBandUp = new Array(count);
        const dBandLow = new Array(count);

        for (let i = 0; i < count; i++) {
            const pt = visibleSlice[i];
            labels[i] = pt.t.toFixed(1) + 's';
            dPos[i] = pt.pos;
            dSp[i] = pt.sp;
            dUp[i] = pt.up;
            dUi[i] = pt.ui;
            dUd[i] = pt.ud;
            dTheo[i] = pt.theory;
            dDist[i] = pt.dist;
            dBandUp[i] = pt.bandUpper;
            dBandLow[i] = pt.bandLower;
        }

        const updateInstance = (chartInstance) => {
            if (!chartInstance) return;
            const data = chartInstance.data;
            data.labels = labels;
            data.datasets[0].data = dPos;
            data.datasets[1].data = dSp;
            data.datasets[2].data = dUp;
            data.datasets[3].data = dUi;
            data.datasets[4].data = dUd;
            data.datasets[5].data = dTheo;
            data.datasets[6].data = dDist;
            data.datasets[7].data = dBandUp;
            data.datasets[8].data = dBandLow;
            chartInstance.update();
        };

        if (this.chart) updateInstance(this.chart);
        if (this.floatingChart) updateInstance(this.floatingChart);
    },

    /**
     * Decimação MinMax: preserva picos, vales e extremos para fidelidade analítica impecável
     */
    _decimateMinMax: function(sourceArray, targetPoints) {
        const len = sourceArray.length;
        if (len <= targetPoints) return sourceArray;

        const result = [sourceArray[0]]; // Sempre preserva o início t=0
        const bucketSize = Math.floor(len / (targetPoints / 2));

        for (let i = 1; i < len - 1; i += bucketSize) {
            const end = Math.min(i + bucketSize, len - 1);
            let minPt = sourceArray[i];
            let maxPt = sourceArray[i];

            for (let j = i + 1; j < end; j++) {
                const pt = sourceArray[j];
                if (pt.pos < minPt.pos) minPt = pt;
                if (pt.pos > maxPt.pos) maxPt = pt;
            }

            // Insere em ordem cronológica de t
            if (minPt.t < maxPt.t) {
                result.push(minPt);
                if (minPt !== maxPt) result.push(maxPt);
            } else {
                result.push(maxPt);
                if (minPt !== maxPt) result.push(minPt);
            }
        }

        result.push(sourceArray[len - 1]); // Sempre preserva o ponto mais recente
        return result;
    },

    /**
     * Força atualização imediata de ambos os gráficos
     */
    refreshCharts: function() {
        this._renderCurrentSlice();
        this.updateRmseDisplay();
    },

    /**
     * Atualiza o display de RMSE nos badges
     */
    updateRmseDisplay: function() {
        if (!this.masterHistory.length) return;
        
        let sumSq = 0;
        const pts = this.masterHistory;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const err = pts[i].sp - pts[i].pos;
            sumSq += err * err;
        }
        const rmse = Math.sqrt(sumSq / n);
        const formatted = rmse.toFixed(2);

        document.querySelectorAll('.metric-rmse-val').forEach(el => {
            el.textContent = formatted;
        });
        const elMain = document.getElementById('metric-rmse');
        if (elMain) elMain.textContent = formatted;
    },

    /**
     * Atualiza as leituras numéricas do rodapé da janela flutuante
     */
    updateFooterStats: function(latest) {
        if (!latest) return;
        const elTime = document.getElementById('flt-stat-time');
        const elPos = document.getElementById('flt-stat-pos');
        const elSp = document.getElementById('flt-stat-sp');
        const elErr = document.getElementById('flt-stat-err');
        const elPts = document.getElementById('flt-stat-points');

        if (elTime) elTime.textContent = latest.t.toFixed(2) + 's';
        if (elPos) elPos.textContent = latest.pos.toFixed(2) + 'm';
        if (elSp) elSp.textContent = latest.sp.toFixed(2) + 'm';
        if (elErr) elErr.textContent = (latest.sp - latest.pos).toFixed(2) + 'm';
        if (elPts) elPts.textContent = this.masterHistory.length;
    },

    /**
     * Alterna a visibilidade de um dataset em ambos os gráficos
     */
    toggleDataset: function(index, isVisible) {
        const applyToggle = (instance) => {
            if (!instance || !instance.data.datasets[index]) return;
            instance.data.datasets[index].hidden = !isVisible;
            instance.update();
        };

        applyToggle(this.chart);
        applyToggle(this.floatingChart);

        // Sincroniza os checkboxes nas interfaces correspondentes
        const ids = [
            ['chk-pv', 'chk-pv-flt'],
            ['chk-sp', 'chk-sp-flt'],
            ['chk-p', 'chk-p-flt'],
            ['chk-i', 'chk-i-flt'],
            ['chk-d', 'chk-d-flt'],
            ['chk-theory', 'chk-theory-flt']
        ];
        if (ids[index]) {
            ids[index].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.checked !== isVisible) el.checked = isVisible;
            });
        }
    },

    /**
     * Alterna a faixa de tolerância de acomodação (datasets 7 e 8)
     */
    toggleToleranceBand: function(isVisible) {
        this.showToleranceBand = isVisible;
        const apply = (instance) => {
            if (!instance) return;
            if (instance.data.datasets[7]) instance.data.datasets[7].hidden = !isVisible;
            if (instance.data.datasets[8]) instance.data.datasets[8].hidden = !isVisible;
            instance.update();
        };
        apply(this.chart);
        apply(this.floatingChart);

        document.querySelectorAll('.chk-band-sync').forEach(chk => {
            if (chk.checked !== isVisible) chk.checked = isVisible;
        });
    },

    /**
     * Reseta todo o histórico e gráficos
     */
    reset: function() {
        this.masterHistory = [];
        this.lastUpdateTime = 0;

        const clearInstance = (instance) => {
            if (!instance) return;
            instance.data.labels = [];
            instance.data.datasets.forEach(d => d.data = []);
            instance.update();
        };

        clearInstance(this.chart);
        clearInstance(this.floatingChart);

        document.querySelectorAll('.metric-rmse-val').forEach(el => el.textContent = '0.00');
        const elMain = document.getElementById('metric-rmse');
        if (elMain) elMain.textContent = '0.00';

        const elPts = document.getElementById('flt-stat-points');
        if (elPts) elPts.textContent = '0';
    },

    /**
     * Exporta todos os pontos coletados para arquivo CSV (para MATLAB/Python/TCC)
     */
    exportCSV: function() {
        if (!this.masterHistory.length) {
            alert('Nenhum dado de simulação disponível para exportação.');
            return;
        }

        const headers = ['tempo_s', 'posicao_m', 'setpoint_m', 'erro_m', 'u_p', 'u_i', 'u_d', 'curva_teorica', 'perturbacao_N'];
        const rows = this.masterHistory.map(pt => [
            pt.t.toFixed(3),
            pt.pos.toFixed(4),
            pt.sp.toFixed(4),
            (pt.sp - pt.pos).toFixed(4),
            pt.up.toFixed(4),
            pt.ui.toFixed(4),
            pt.ud.toFixed(4),
            pt.theory.toFixed(4),
            pt.dist.toFixed(4)
        ].join(','));

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `pid_telemetria_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Exporta o gráfico atual como imagem PNG em alta resolução
     */
    exportPNG: function() {
        const activeInstance = this.floatingChart || this.chart;
        if (!activeInstance) {
            alert('Gráfico não disponível para exportação.');
            return;
        }

        const link = document.createElement('a');
        link.download = `pid_curva_resposta_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.png`;
        link.href = activeInstance.toBase64Image('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
