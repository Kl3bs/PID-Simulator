/**
 * MÓDULO DE TELEMETRIA E ANÁLISE GRÁFICA DIDÁTICA
 * Permite visualização em tempo real da saída do processo, setpoint,
 * decomposição das ações P, I, D e curva analítica de referência para TCC.
 */
window.ChartAnalytics = {
    chart: null,
    lastUpdateTime: 0,
    maxPoints: 200,

    init: function(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Posição y(t)',
                        data: [],
                        borderColor: '#00F2FE', // Ciano vibrante
                        backgroundColor: 'rgba(0, 242, 254, 0.05)',
                        borderWidth: 2.5,
                        yAxisID: 'y',
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Setpoint r(t)',
                        data: [],
                        borderColor: '#FF5252', // Carmim tracejado
                        borderDash: [6, 4],
                        borderWidth: 2,
                        yAxisID: 'y',
                        pointRadius: 0
                    },
                    {
                        label: 'Ação P (u_p)',
                        data: [],
                        borderColor: '#FFB300', // Âmbar
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: false
                    },
                    {
                        label: 'Ação I (u_i)',
                        data: [],
                        borderColor: '#00E676', // Esmeralda
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: false
                    },
                    {
                        label: 'Ação D (u_d)',
                        data: [],
                        borderColor: '#E040FB', // Roxo ultravioleta
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: false
                    },
                    {
                        label: 'Curva Teórica',
                        data: [],
                        borderColor: '#94A3B8', // Cinza azulado
                        borderDash: [3, 3],
                        borderWidth: 1.5,
                        yAxisID: 'y',
                        pointRadius: 0,
                        hidden: true
                    },
                    {
                        label: 'Perturbação',
                        data: [],
                        borderColor: '#EF4444', // Vermelho
                        borderWidth: 1.2,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        hidden: true
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
                        ticks: { color: '#94A3B8', maxTicksLimit: 8, font: { size: 10 } }
                    },
                    y: {
                        title: { display: true, text: 'Posição / Referência', color: '#94A3B8', font: { size: 11 } },
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#00F2FE', font: { size: 10 } }
                    },
                    y1: {
                        title: { display: true, text: 'Esforço de Controle (u)', color: '#94A3B8', font: { size: 11 } },
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#FFB300', font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Usamos os toggles customizados na interface
                    },
                    tooltip: {
                        backgroundColor: '#121826',
                        titleColor: '#00F2FE',
                        bodyColor: '#FFFFFF',
                        borderColor: '#1E293B',
                        borderWidth: 1
                    }
                }
            }
        });
    },

    /**
     * Calcula resposta analítica aproximada de 2ª ordem para o setpoint atual
     */
    _calcTheoreticalResponse: function(t, setpoint) {
        if (t <= 0) return 0;
        const wn = 1.8; // Frequência natural característica
        const zeta = 0.55; // Fator de amortecimento
        const wd = wn * Math.sqrt(Math.max(0.01, 1 - zeta * zeta));
        const envelope = Math.exp(-zeta * wn * t);
        const y = setpoint * (1 - envelope * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t)));
        return Math.max(0, y);
    },

    tick: function(timestamp, position, setPoint, error, force, disturbance = 0, up = 0, ui = 0, ud = 0) {
        if (!this.chart) return;

        if (timestamp - this.lastUpdateTime < 50) return;
        this.lastUpdateTime = timestamp;

        const data = this.chart.data;
        const t = window.SIM_STATE.simTime || 0;
        const timeLabel = t.toFixed(2) + 's';
        const theoreticalY = this._calcTheoreticalResponse(t, setPoint);

        data.labels.push(timeLabel);
        data.datasets[0].data.push(position);
        data.datasets[1].data.push(setPoint);
        data.datasets[2].data.push(up);
        data.datasets[3].data.push(ui);
        data.datasets[4].data.push(ud);
        data.datasets[5].data.push(theoreticalY);
        data.datasets[6].data.push(disturbance);

        if (data.labels.length > this.maxPoints) {
            data.labels.shift();
            data.datasets.forEach(d => d.data.shift());
        }

        this.chart.update();
        this.updateRmseDisplay();
    },

    updateRmseDisplay: function() {
        if (!this.chart || !this.chart.data.datasets[0].data.length) return;
        const positions = this.chart.data.datasets[0].data;
        const setpoints = this.chart.data.datasets[1].data;
        let sumSq = 0;
        for (let i = 0; i < positions.length; i++) {
            const err = setpoints[i] - positions[i];
            sumSq += err * err;
        }
        const rmse = Math.sqrt(sumSq / positions.length);
        const el = document.getElementById('metric-rmse');
        if (el) el.textContent = rmse.toFixed(2);
    },

    toggleDataset: function(index, isVisible) {
        if (!this.chart || !this.chart.data.datasets[index]) return;
        this.chart.data.datasets[index].hidden = !isVisible;
        this.chart.update();
    },

    reset: function() {
        if (!this.chart) return;
        this.chart.data.labels = [];
        this.chart.data.datasets.forEach(d => d.data = []);
        this.chart.update();
        const el = document.getElementById('metric-rmse');
        if (el) el.textContent = '0.00';
    }
};
