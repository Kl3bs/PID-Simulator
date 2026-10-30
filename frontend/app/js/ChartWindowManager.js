/**
 * GERENCIADOR DA JANELA FLUTUANTE E DESTACÁVEL DE GRÁFICOS (ChartWindowManager)
 * - Permite arrastar (drag), redimensionar (resize), maximizar, ancorar e desacoplar em popup
 * - Sincronização bidirecional de todos os controles de sinais e horizontes temporais
 * - Observador de redimensionamento de alta performance (ResizeObserver)
 */
window.ChartWindowManager = {
    windowEl: null,
    dragHandle: null,
    canvasContainer: null,
    isOpen: false,
    isMaximized: false,
    savedBounds: null,
    resizeObserver: null,
    externalWindow: null,

    init: function() {
        this.windowEl = document.getElementById('floating-chart-window');
        this.dragHandle = document.getElementById('floating-chart-drag-handle');
        this.canvasContainer = document.getElementById('floating-chart-canvas-container');

        if (!this.windowEl || !this.dragHandle) return;

        this._setupDragging();
        this._setupResizeObserver();
        this._setupActionButtons();
        this._setupSyncControls();
    },

    /**
     * Configura o arrasto fluido por mouse e touch
     */
    _setupDragging: function() {
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        const onPointerDown = (e) => {
            // Ignora cliques nos botões de controle da janela
            if (e.target.closest('.window-action-btn') || this.isMaximized) return;

            isDragging = true;
            this.dragHandle.style.cursor = 'grabbing';
            this.windowEl.style.transition = 'none';

            const rect = this.windowEl.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            // Clamping para não sair da viewport
            const maxLeft = window.innerWidth - (this.windowEl.offsetWidth || 500);
            const maxTop = window.innerHeight - (this.windowEl.offsetHeight || 300);

            newLeft = Math.max(10, Math.min(newLeft, maxLeft - 10));
            newTop = Math.max(10, Math.min(newTop, maxTop - 10));

            this.windowEl.style.left = newLeft + 'px';
            this.windowEl.style.top = newTop + 'px';
            this.windowEl.style.transform = 'none'; // Desabilita transform fixo de centralização
        };

        const onPointerUp = () => {
            if (!isDragging) return;
            isDragging = false;
            this.dragHandle.style.cursor = 'grab';
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        };

        this.dragHandle.addEventListener('pointerdown', onPointerDown);
    },

    /**
     * Monitora redimensionamento em tempo real do container para ajustar o canvas
     */
    _setupResizeObserver: function() {
        if (!window.ResizeObserver || !this.canvasContainer) return;

        let resizeTimeout;
        this.resizeObserver = new ResizeObserver(() => {
            if (!this.isOpen) return;
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.ChartAnalytics && window.ChartAnalytics.floatingChart) {
                    window.ChartAnalytics.floatingChart.resize();
                }
            }, 30);
        });

        this.resizeObserver.observe(this.canvasContainer);
    },

    /**
     * Vincula botões de controle da janela e exportação
     */
    _setupActionButtons: function() {
        // Botão principal no painel ancorado para destacar janela
        const btnPopout = document.getElementById('btn-popout-chart');
        if (btnPopout) {
            btnPopout.addEventListener('click', () => {
                if (this.isOpen) {
                    this.close();
                } else {
                    this.open();
                }
            });
        }

        // Botões de cabeçalho da janela flutuante
        const btnClose = document.getElementById('btn-chart-close');
        if (btnClose) btnClose.addEventListener('click', () => this.close());

        const btnDock = document.getElementById('btn-chart-dock');
        if (btnDock) {
            btnDock.addEventListener('click', () => {
                this.close();
                // Ativa a aba "Comportamento Visual" no painel principal
                const chartTabBtn = document.querySelector('.tab-btn[data-tab="chart"]');
                if (chartTabBtn) chartTabBtn.click();
            });
        }

        const btnMaximize = document.getElementById('btn-chart-maximize');
        if (btnMaximize) btnMaximize.addEventListener('click', () => this.toggleMaximize());

        const btnExternal = document.getElementById('btn-chart-external');
        if (btnExternal) btnExternal.addEventListener('click', () => this.openExternalWindow());

        // Botões de exportação
        document.querySelectorAll('.btn-export-csv').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.ChartAnalytics) window.ChartAnalytics.exportCSV();
            });
        });

        document.querySelectorAll('.btn-export-png').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.ChartAnalytics) window.ChartAnalytics.exportPNG();
            });
        });
    },

    /**
     * Vincula todos os controles (checkboxes de sinais e botões de tempo) para sincronização perfeita
     */
    _setupSyncControls: function() {
        // Toggles de sinais: sincroniza pares ancorado / flutuante
        const signalPairs = [
            { mainId: 'chk-pv', fltId: 'chk-pv-flt', index: 0 },
            { mainId: 'chk-sp', fltId: 'chk-sp-flt', index: 1 },
            { mainId: 'chk-p',  fltId: 'chk-p-flt',  index: 2 },
            { mainId: 'chk-i',  fltId: 'chk-i-flt',  index: 3 },
            { mainId: 'chk-d',  fltId: 'chk-d-flt',  index: 4 },
            { mainId: 'chk-theory', fltId: 'chk-theory-flt', index: 5 }
        ];

        signalPairs.forEach(({ mainId, fltId, index }) => {
            const elMain = document.getElementById(mainId);
            const elFlt = document.getElementById(fltId);

            if (elMain) {
                elMain.addEventListener('change', (e) => {
                    if (elFlt && elFlt.checked !== e.target.checked) elFlt.checked = e.target.checked;
                    if (window.ChartAnalytics) window.ChartAnalytics.toggleDataset(index, e.target.checked);
                });
            }

            if (elFlt) {
                elFlt.addEventListener('change', (e) => {
                    if (elMain && elMain.checked !== e.target.checked) elMain.checked = e.target.checked;
                    if (window.ChartAnalytics) window.ChartAnalytics.toggleDataset(index, e.target.checked);
                });
            }
        });

        // Faixa de Tolerância ±2%
        const elBandMain = document.getElementById('chk-band');
        const elBandFlt = document.getElementById('chk-band-flt');
        const onBandToggle = (checked) => {
            if (elBandMain && elBandMain.checked !== checked) elBandMain.checked = checked;
            if (elBandFlt && elBandFlt.checked !== checked) elBandFlt.checked = checked;
            if (window.ChartAnalytics) window.ChartAnalytics.toggleToleranceBand(checked);
        };
        if (elBandMain) elBandMain.addEventListener('change', (e) => onBandToggle(e.target.checked));
        if (elBandFlt) elBandFlt.addEventListener('change', (e) => onBandToggle(e.target.checked));

        // Anti-Windup
        const elAntiWindupFlt = document.getElementById('chk-antiwindup-flt');
        if (elAntiWindupFlt) {
            elAntiWindupFlt.addEventListener('change', (e) => {
                const checked = e.target.checked;
                if (window.SIM_STATE) window.SIM_STATE.enableAntiWindup = checked;
                const elAntiWindupMain = document.getElementById('chk-antiwindup-chart');
                if (elAntiWindupMain) elAntiWindupMain.checked = checked;
                const btnAntiWindup = document.getElementById('btn-toggle-antiwindup');
                if (btnAntiWindup) {
                    btnAntiWindup.click(); // Alterna e atualiza o estado global
                }
            });
        }

        // Seletor de Horizonte de Tempo (10s, 30s, 60s, Completo)
        document.querySelectorAll('.btn-time-window').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.window;
                if (window.ChartAnalytics) {
                    window.ChartAnalytics.setTimeWindow(mode);
                }
            });
        });
    },

    /**
     * Abre a janela flutuante
     */
    open: function() {
        if (!this.windowEl) return;
        this.isOpen = true;
        this.windowEl.style.display = 'flex';

        // Atualiza estilo do botão de destacar
        const btnPopout = document.getElementById('btn-popout-chart');
        if (btnPopout) {
            btnPopout.classList.add('active');
            btnPopout.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="3"></rect>
                    <polyline points="15 9 10 14 8 12"></polyline>
                </svg>
                <span>Janela Aberta</span>
            `;
        }

        // Inicializa o Chart.js na janela flutuante se ainda não estiver pronto
        if (window.ChartAnalytics && !window.ChartAnalytics.floatingChart) {
            window.ChartAnalytics.initFloating('responseChartFloating');
        }

        // Garante redimensionamento inicial do canvas flutuante
        setTimeout(() => {
            if (window.ChartAnalytics && window.ChartAnalytics.floatingChart) {
                window.ChartAnalytics.floatingChart.resize();
                window.ChartAnalytics.refreshCharts();
            }
        }, 50);
    },

    /**
     * Fecha / Aninha a janela flutuante
     */
    close: function() {
        if (!this.windowEl) return;
        this.isOpen = false;
        this.windowEl.style.display = 'none';

        const btnPopout = document.getElementById('btn-popout-chart');
        if (btnPopout) {
            btnPopout.classList.remove('active');
            btnPopout.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                <span>Destacar Janela</span>
            `;
        }

        // Atualiza o gráfico ancorado
        if (window.ChartAnalytics && window.ChartAnalytics.chart) {
            window.ChartAnalytics.chart.resize();
        }
    },

    /**
     * Alterna o estado de tela cheia / maximizado
     */
    toggleMaximize: function() {
        if (!this.windowEl) return;

        if (!this.isMaximized) {
            // Salva posição e dimensões anteriores
            this.savedBounds = {
                left: this.windowEl.style.left,
                top: this.windowEl.style.top,
                width: this.windowEl.style.width,
                height: this.windowEl.style.height
            };

            this.windowEl.classList.add('maximized');
            this.isMaximized = true;

            const btnMax = document.getElementById('btn-chart-maximize');
            if (btnMax) {
                btnMax.title = "Restaurar Tamanho Normal";
                btnMax.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="4 14 10 14 10 20"></polyline>
                        <polyline points="20 10 14 10 14 4"></polyline>
                        <line x1="14" y1="10" x2="21" y2="3"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                `;
            }
        } else {
            this.windowEl.classList.remove('maximized');
            this.isMaximized = false;

            if (this.savedBounds) {
                this.windowEl.style.left = this.savedBounds.left || '';
                this.windowEl.style.top = this.savedBounds.top || '';
                this.windowEl.style.width = this.savedBounds.width || '';
                this.windowEl.style.height = this.savedBounds.height || '';
            }

            const btnMax = document.getElementById('btn-chart-maximize');
            if (btnMax) {
                btnMax.title = "Maximizar Janela";
                btnMax.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                `;
            }
        }

        setTimeout(() => {
            if (window.ChartAnalytics && window.ChartAnalytics.floatingChart) {
                window.ChartAnalytics.floatingChart.resize();
            }
        }, 60);
    },

    /**
     * Desacopla o gráfico em uma janela separada do navegador (window.open) para múltiplos monitores
     */
    openExternalWindow: function() {
        const width = 1100;
        const height = 650;
        const left = Math.max(0, (window.screen.width - width) / 2);
        const top = Math.max(0, (window.screen.height - height) / 2);

        const pop = window.open(
            '',
            'PID_Chart_Window',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no`
        );

        if (!pop) {
            alert('Abertura de pop-up bloqueada pelo navegador. Permita pop-ups para usar em janela externa dedicada ou continue usando a janela flutuante interna.');
            return;
        }

        this.externalWindow = pop;

        // Injeta estrutura HTML completa com o tema escuro idêntico
        pop.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Curva de Resposta PID - Janela Externa</title>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        background: #141414;
                        color: #F1F5F9;
                        font-family: 'Inter', sans-serif;
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .ext-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 16px;
                        background: #1C1C1C;
                        border-bottom: 1px solid rgba(255,255,255,0.08);
                    }
                    .ext-title {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: 700;
                        font-size: 0.9em;
                        color: #F97316;
                    }
                    .ext-toolbar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 12px;
                        padding: 8px 16px;
                        background: #242424;
                        border-bottom: 1px solid rgba(255,255,255,0.06);
                    }
                    .ext-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                    .ext-toggle {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        font-size: 0.74em;
                        font-weight: 600;
                        color: #94A3B8;
                        cursor: pointer;
                    }
                    .ext-toggle input { accent-color: #F97316; cursor: pointer; }
                    .ext-btn {
                        background: #2A2A2A;
                        color: #94A3B8;
                        border: 1px solid rgba(255,255,255,0.1);
                        padding: 4px 10px;
                        border-radius: 4px;
                        font-size: 0.72em;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.15s;
                    }
                    .ext-btn:hover { background: #313131; color: #FFF; }
                    .ext-btn.active { background: rgba(249,115,22,0.15); color: #F97316; border-color: rgba(249,115,22,0.4); }
                    .ext-canvas-wrap { flex: 1; position: relative; padding: 12px; min-height: 200px; }
                    .ext-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 6px 16px;
                        background: #1C1C1C;
                        border-top: 1px solid rgba(255,255,255,0.08);
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 0.72em;
                        color: #94A3B8;
                    }
                </style>
            </head>
            <body>
                <div class="ext-header">
                    <div class="ext-title">
                        <span>Telemetria em Tempo Real (Janela Desacoplada)</span>
                    </div>
                    <div style="font-size: 0.72em; color: #00E676; font-weight: 600;">● Sincronizado com Simulador</div>
                </div>
                <div class="ext-toolbar">
                    <div class="ext-group">
                        <label class="ext-toggle"><input type="checkbox" id="ext-pv" checked><span style="color:#00F2FE;">y(t) Posição</span></label>
                        <label class="ext-toggle"><input type="checkbox" id="ext-sp" checked><span style="color:#FF5252;">r(t) Meta</span></label>
                        <label class="ext-toggle"><input type="checkbox" id="ext-p" checked><span style="color:#FFB300;">Ação P</span></label>
                        <label class="ext-toggle"><input type="checkbox" id="ext-i" checked><span style="color:#00E676;">Ação I</span></label>
                        <label class="ext-toggle"><input type="checkbox" id="ext-d" checked><span style="color:#E040FB;">Ação D</span></label>
                        <label class="ext-toggle"><input type="checkbox" id="ext-theory"><span style="color:#94A3B8;">Teórica</span></label>
                        <label class="ext-toggle"><input type="checkbox" id="ext-band" checked><span style="color:#FF5252;">Faixa ±2%</span></label>
                    </div>
                    <div class="ext-group">
                        <span style="font-size: 0.72em; color: #64748B;">Horizonte:</span>
                        <button class="ext-btn" data-w="10">10s</button>
                        <button class="ext-btn" data-w="30">30s</button>
                        <button class="ext-btn" data-w="60">60s</button>
                        <button class="ext-btn active" data-w="full">Completo</button>
                    </div>
                </div>
                <div class="ext-canvas-wrap">
                    <canvas id="extChartCanvas"></canvas>
                </div>
                <div class="ext-footer">
                    <div>RMSE: <strong id="ext-rmse" style="color: #F97316;">0.00</strong></div>
                    <div>Tempo: <span id="ext-time">0.00s</span> | Posição: <span id="ext-pos">0.00m</span></div>
                </div>
            </body>
            </html>
        `);
        pop.document.close();

        // Inicializa o Chart.js na janela filha sincronizado com o masterHistory da janela pai
        pop.onload = () => {
            const ctx = pop.document.getElementById('extChartCanvas');
            if (!ctx) return;
            const extChart = new pop.Chart(ctx, window.ChartAnalytics._createConfig());

            // Loop de sincronização síncrono a cada 50ms
            const interval = setInterval(() => {
                if (pop.closed) {
                    clearInterval(interval);
                    return;
                }
                if (window.ChartAnalytics && window.ChartAnalytics.masterHistory.length) {
                    const hist = window.ChartAnalytics.masterHistory;
                    const mode = window.ChartAnalytics.timeWindowMode;
                    const latest = hist[hist.length - 1];

                    let slice = hist;
                    if (mode !== 'full') {
                        const winSec = parseFloat(mode) || 30;
                        const start = Math.max(0, latest.t - winSec);
                        slice = hist.filter(p => p.t >= start);
                    }
                    if (slice.length > 800) {
                        slice = window.ChartAnalytics._decimateMinMax(slice, 600);
                    }

                    const data = extChart.data;
                    data.labels = slice.map(p => p.t.toFixed(1) + 's');
                    data.datasets[0].data = slice.map(p => p.pos);
                    data.datasets[1].data = slice.map(p => p.sp);
                    data.datasets[2].data = slice.map(p => p.up);
                    data.datasets[3].data = slice.map(p => p.ui);
                    data.datasets[4].data = slice.map(p => p.ud);
                    data.datasets[5].data = slice.map(p => p.theory);
                    data.datasets[6].data = slice.map(p => p.dist);
                    data.datasets[7].data = slice.map(p => p.bandUpper);
                    data.datasets[8].data = slice.map(p => p.bandLower);
                    extChart.update();

                    const elTime = pop.document.getElementById('ext-time');
                    const elPos = pop.document.getElementById('ext-pos');
                    const elRmse = pop.document.getElementById('ext-rmse');
                    if (elTime) elTime.textContent = latest.t.toFixed(2) + 's';
                    if (elPos) elPos.textContent = latest.pos.toFixed(2) + 'm';
                    if (elRmse) {
                        const mainRmse = document.getElementById('metric-rmse');
                        if (mainRmse) elRmse.textContent = mainRmse.textContent;
                    }
                }
            }, 60);

            // Vincula botões de tempo e toggles da janela popup
            pop.document.querySelectorAll('.ext-btn[data-w]').forEach(btn => {
                btn.addEventListener('click', () => {
                    pop.document.querySelectorAll('.ext-btn[data-w]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (window.ChartAnalytics) {
                        window.ChartAnalytics.setTimeWindow(btn.dataset.w);
                    }
                });
            });

            const toggleExtMap = [
                { id: 'ext-pv', idx: 0 },
                { id: 'ext-sp', idx: 1 },
                { id: 'ext-p',  idx: 2 },
                { id: 'ext-i',  idx: 3 },
                { id: 'ext-d',  idx: 4 },
                { id: 'ext-theory', idx: 5 }
            ];
            toggleExtMap.forEach(({ id, idx }) => {
                const el = pop.document.getElementById(id);
                if (el) {
                    el.addEventListener('change', (e) => {
                        extChart.data.datasets[idx].hidden = !e.target.checked;
                        extChart.update();
                        if (window.ChartAnalytics) window.ChartAnalytics.toggleDataset(idx, e.target.checked);
                    });
                }
            });

            const elBand = pop.document.getElementById('ext-band');
            if (elBand) {
                elBand.addEventListener('change', (e) => {
                    extChart.data.datasets[7].hidden = !e.target.checked;
                    extChart.data.datasets[8].hidden = !e.target.checked;
                    extChart.update();
                    if (window.ChartAnalytics) window.ChartAnalytics.toggleToleranceBand(e.target.checked);
                });
            }
        };
    }
};
