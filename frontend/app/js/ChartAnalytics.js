window.ChartAnalytics = {
    chart: null,
    lastUpdateTime: 0,
    maxPoints: 200, // 200 points to keep in chart

    init: function(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Posição',
                        data: [],
                        borderColor: '#04A777',
                        borderWidth: 2,
                        yAxisID: 'y',
                        pointRadius: 0
                    },
                    {
                        label: 'Meta',
                        data: [],
                        borderColor: '#1A1A2E',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        yAxisID: 'y',
                        pointRadius: 0
                    },
                    {
                        label: 'Força/Controle',
                        data: [],
                        borderColor: '#FF6B35',
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0
                    },
                    {
                        label: 'Erro',
                        data: [],
                        borderColor: '#FFB703',
                        borderWidth: 1.5,
                        yAxisID: 'y',
                        pointRadius: 0
                    },
                    {
                        label: 'Perturbação',
                        data: [],
                        borderColor: '#d90429',
                        borderWidth: 1.5,
                        yAxisID: 'y1',
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        title: { display: true, text: 'Posição / Erro' },
                        position: 'left'
                    },
                    y1: {
                        title: { display: true, text: 'Força' },
                        position: 'right',
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    }
                }
            }
        });
    },

    tick: function(timestamp, position, setPoint, error, force, disturbance = 0) {
        if (!this.chart) return;

        // Limita a taxa de atualização
        if (timestamp - this.lastUpdateTime < 60) return;
        this.lastUpdateTime = timestamp;

        const data = this.chart.data;
        const timeLabel = (window.SIM_STATE.simTime || 0).toFixed(1) + 's';

        data.labels.push(timeLabel);
        data.datasets[0].data.push(position);
        data.datasets[1].data.push(setPoint);
        data.datasets[2].data.push(force);
        data.datasets[3].data.push(error);
        data.datasets[4].data.push(disturbance);

        if (data.labels.length > this.maxPoints) {
            data.labels.shift();
            data.datasets.forEach(d => d.data.shift());
        }

        this.chart.update();
    },

    reset: function() {
        if (!this.chart) return;
        this.chart.data.labels = [];
        this.chart.data.datasets.forEach(d => d.data = []);
        this.chart.update();
    }
};
