# Documento de Especificação Técnica: Enriquecimento Didático e Científico do PID Simulator para TCC

- **Data**: 16 de setembro de 2026
- **Status**: Aprovado
- **Autor**: Kleber Vasconcelos & Antigravity Agent
- **Contexto**: Trabalho de Conclusão de Curso (TCC) em Engenharia / Computação
- **Skills Aplicadas**: `frontend-design`, `fullstack-guardian`, `tcc-writer`

---

## 1. Visão Geral e Objetivos do TCC

O **PID Simulator** é uma plataforma educacional interativa desenvolvida como Trabalho de Conclusão de Curso (TCC). O objetivo é preencher a lacuna entre a fundamentação teórica de Sistemas de Controle e a prática de implementação em software, permitindo que estudantes escrevam algoritmos PID em tempo real, visualizem a resposta em uma cena 3D e analisem a telemetria com rigor acadêmico.

### Objetivos Específicos:
1. **Transparência Pedagógica (Decomposição $P, I, D$)**: Permitir que o estudante visualize individualmente cada parcela do esforço de controle ($u_P, u_I, u_D$) e os limites de saturação do atuador via checkboxes/toggles no osciloscópio.
2. **Métodos Clássicos de Sintonia (Ziegler-Nichols)**: Implementar um módulo interativo que executa ensaios em malha aberta (curva de reação), extrai parâmetros da planta ($K, \tau, \theta$), calcula ganhos teóricos e os injeta no editor com um clique.
3. **Validação Técnica e Exportação Científica**: Fornecer cálculo automático de métricas de controle ($t_r, t_s, M_p, e_{ss}, \text{RMSE}$), exportação de dados em formato CSV para gráficos do TCC e geração de relatórios PDF enriquecidos com diagnóstico de sintonia.

---

## 2. Identidade Visual e Design de Interface (`frontend-design`)

### 2.1 Design Tokens e Paleta de Cores
A interface segue a estética de uma **Estação de Instrumentação de Controle**, com contraste elevado e significado funcional para cada cor:

| Elemento / Sinal | Token | Valor Hex | Descrição / Função |
| :--- | :--- | :--- | :--- |
| Background Primário | `--bg-workstation` | `#0B0F19` | Fundo principal ardósia escuro |
| Superfície / Painéis | `--bg-panel` | `#121826` | Fundo dos módulos e consoles |
| Bordas e Divisores | `--border-subtle` | `#1E293B` | Linhas delimitadoras sutis |
| Variável de Processo $y(t)$ | `--signal-pv` | `#00F2FE` | Curva da saída do sistema no osciloscópio |
| Setpoint de Referência $r(t)$ | `--signal-sp` | `#FF5252` | Linha tracejada do objetivo desejado |
| Ação Proporcional $u_P(t)$ | `--signal-p` | `#FFB300` | Cor âmbar para a força proporcional |
| Ação Integral $u_I(t)$ | `--signal-i` | `#00E676` | Cor esmeralda para a acumulação integral |
| Ação Derivativa $u_D(t)$ | `--signal-d` | `#E040FB` | Cor roxo ultravioleta para a ação preditiva |
| Curva Analítica Teórica | `--signal-theory` | `#64748B` | Curva teórica exata de referência |

### 2.2 Layout da Aplicação (Wireframe Estrutural)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🎛️ PID SIMULATOR WORKSTATION — Laboratório Virtual de Controle                            │
├──────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ 🎮 BANCADA DE ENSAIOS 3D (Three.js)          │ 📈 OSCILOSCÓPIO & TELEMETRIA DIDÁTICA        │
│ • Cena física com vetores de força e setpoint │ • Saída y(t) vs Setpoint r(t)               │
│ • Feedback de saturação em tempo real        │ • [x] y(t)  [x] u_P  [x] u_I  [x] u_D  [ ] Teo│
│ • Seletor de Fases (Carro, Drone, Navio)     │ • Cartões de Métricas: tr, ts, Mp, ess, RMSE │
├──────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ 💻 CONSOLE DO ENGENHEIRO & SINTONIA                                                         │
│ ┌───────────────────────────────────────────┐  ┌───────────────────────────────────────────┐│
│ │ 📝 Editor de Algoritmo PID (CodeMirror)   │  │ ⚡ Assistente de Sintonia Clássica         ││
│ │ • Execução isolada em sandbox             │  │ • Ensaio Curva de Reação (Malha Aberta)   ││
│ │ • Snippets: PID Padrão, Anti-Windup, Filtro│  │ • Ganhos Ziegler-Nichols / Cohen-Coon    ││
│ │ • [▶ SIMULAR] [⏸ PAUSAR] [↺ REINICIAR]   │  │ • [📥 Aplicar Ganhos no Editor]          ││
│ └───────────────────────────────────────────┘  └───────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📄 Exportar Dados TCC: [💾 Baixar Relatório PDF com Diagnóstico] [📊 Exportar CSV]          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Arquitetura Fullstack e Componentes (`fullstack-guardian`)

### 3.1 Camada Frontend
1. **`ChartAnalytics.js` (Telemetria Didática)**:
   - Gerencia o gráfico Chart.js com múltiplos datasets dinâmicos:
     - Dataset 0: $y(t)$ (Variável de Processo)
     - Dataset 1: $r(t)$ (Setpoint)
     - Dataset 2: $u_P(t)$ (Parcela Proporcional)
     - Dataset 3: $u_I(t)$ (Parcela Integral)
     - Dataset 4: $u_D(t)$ (Parcela Derivativa)
     - Dataset 5: $y_{\text{teorico}}(t)$ (Resposta analítica de referência)
   - Controles de visibilidade (toggles) integrados diretamente na UI.
   - Cálculo e exibição contínua do RMSE (Root Mean Square Error).

2. **`Scene3D.js` & Circuito com Aclives/Declives Dinâmicos (Three.js)**:
   - **Circuito Modular Tridimensional**:
     - Modelagem da pista via malha segmentada ou curva 3D (`CatmullRomCurve3` / `BufferGeometry`), contendo curvas suaves, zebras laterais e portal de setpoint iluminado.
   - **Modos de Relevo Interativos**:
     - Botões no console de controle: `[ Pista Plana ]`, `[ Aclive ↗ (+15°) ]`, `[ Declive ↘ (-15°) ]`, `[ Relevo Ondulado 〰 ]`.
     - Deformação geométrica em tempo real dos vértices da pista (`position.needsUpdate = true`).
   - **Física Gravitacional no Relevo**:
     - Cálculo contínuo da inclinação instantânea $\alpha(x) = \arctan\left(\frac{dh}{dx}\right)$.
     - Perturbação física realista: $F_{\text{relevo}} = - m \cdot g \cdot \sin(\alpha(x))$.
     - O carro alinha seu *pitch* (inclinação longitudinal) com a tangente da pista e as rodas giram acompanhando a velocidade angular.
   - **Efeitos Visuais e Iluminação (`threejs-lighting` & `threejs-materials`)**:
     - Faróis com `SpotLight`, sombras suaves e câmera com amortecimento (*lerp*) para acompanhar o carro no circuito.

3. **`TuningAssistant.js` (Novo Módulo de Sintonia)**:
   - Executa ensaio automatizado com entrada em degrau em malha aberta ($u(t) = 1.0$).
   - Coleta a curva de reação do processo até a estabilização.
   - Aplica o método da reta tangente no ponto de maior derivada para calcular:
     - Ganho estático: $K = \frac{\Delta y}{\Delta u}$
     - Tempo morto / atraso aparente: $\theta$
     - Constante de tempo: $\tau$
   - Calcula tabela de parâmetros de Ziegler-Nichols:
     - $P$: $K_p = \frac{\tau}{K \theta}$
     - $PI$: $K_p = 0.9 \frac{\tau}{K \theta}$, $K_i = \frac{K_p}{3.33 \theta}$
     - $PID$: $K_p = 1.2 \frac{\tau}{K \theta}$, $K_i = \frac{K_p}{2 \theta}$, $K_d = K_p (0.5 \theta)$
   - Botão "Aplicar no Editor" que atualiza as variáveis $K_p, K_i, K_d$ no CodeMirror.

3. **`PhysicsEngine.js` & Sandbox de Execução**:
   - Execução do algoritmo do usuário em escopo seguro sem acesso a objetos globais sensíveis (`window`, `document`, `fetch`, `localStorage`).
   - Retorno padronizado de objeto de controle:
     ```javascript
     {
       u: u_total,
       up: p_term,
       ui: i_term,
       ud: d_term,
       saturated: (u_total >= 100 || u_total <= -100)
     }
     ```

### 3.2 Camada Backend (FastAPI + Python)
1. **`schemas/run.py`**:
   - Validação com Pydantic v2 para receber séries temporais completas com $u_P, u_I, u_D$ e métricas consolidadas.
2. **`services/report_generator.py`**:
   - Geração de PDF com Matplotlib + ReportLab:
     - Gráfico 1: Posição $y(t)$ vs. Referência $r(t)$.
     - Gráfico 2: Decomposição das Forças de Controle $u_P, u_I, u_D$ e linha de saturação.
     - Diagnóstico de Sintonia Automático gerado por regras baseadas em $M_p$, $t_s$ e $e_{ss}$.
3. **`api/v1/endpoints/runs.py`**:
   - Endpoint `GET /api/v1/runs/{id}/export-csv`: Gera arquivo CSV estruturado com colunas `time_s`, `setpoint`, `position_y`, `control_u`, `u_p`, `u_i`, `u_d`, `error` para importação direta em ferramentas de análise do TCC.

### 3.3 Camada de Segurança e Resiliência
- **Proteção contra SQL Injection**: Consultas estruturadas via SQLAlchemy ORM.
- **Prevenção de DoS no Backend**: Limite de amostras por run (máximo de 3.000 pontos de amostragem por payload).
- **Modo Offline**: Armazenamento em cache local via `localStorage` se a conexão com o backend for interrompida.

---

## 4. Plano de Validação e Verificação

1. **Testes Unitários no Backend**:
   - Validação de schemas Pydantic com payloads válidos e corrompidos.
   - Teste de cálculo de diagnóstico e geração de PDF / CSV sem exceções.
2. **Testes de Integração e Física no Frontend**:
   - Verificação do ensaio de Ziegler-Nichols com planta de 1ª e 2ª ordem conhecida.
   - Verificação de estabilidade da taxa de quadros (≥ 30 FPS com telemetria ativa).
   - Teste de visibilidade dos toggles sem quebra de renderização do Chart.js.
3. **Benchmarking Acadêmico**:
   - Comparação da curva do simulador com a resposta analítica calculada em Python (SciPy).

---

## 5. Próximos Passos
Após a aprovação desta especificação, o desenvolvimento segue com a criação do plano de implementação detalhado e a execução das alterações no frontend e backend.
