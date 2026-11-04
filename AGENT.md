# Guia de Orientação para Agentes e Modelos de Linguagem (LLMs)

Este documento foi elaborado para orientar modelos de linguagem (LLMs) e agentes autônomos de desenvolvimento (como Claude Code, Cursor, Copilot, Antigravity, Devin, etc.) que forem clonar, analisar, estender ou dar manutenção neste repositório.

---

## 1. Visão Geral do Projeto

O **PID Simulator** é um laboratório virtual interativo em 3D voltado para o ensino didático e experimental da Teoria de Controle Automático e identificação de sistemas (com ênfase no controlador Proporcional-Integral-Derivativo — PID).

### Arquitetura do Sistema

A aplicação é dividida em duas camadas completamente desacopladas:

1. **Frontend (Cliente Web SPA)**
   - Localização: `frontend/app/`
   - Tecnologia: Vanilla JavaScript modular (ES6+), HTML5 e CSS3 moderno.
   - Bibliotecas gráficas via CDN:
     - **Three.js (r128)**: renderização de cena 3D, malhas poligonais, texturas, iluminação e sombras.
     - **Chart.js (v3.9.1)**: plotagem em tempo real de curvas temporais (sinal de controle, variável de processo, erro e setpoint).
     - **CodeMirror (v5.65.16)**: editor de código com destaque de sintaxe JavaScript para algoritmos de controle customizados escritos pelo usuário.
   - Sem frameworks reativos pesados (sem React, Vue ou Angular) e sem etapa de compilação/bundling (sem Vite ou Webpack). Os scripts são importados diretamente no `index.html`.

2. **Backend (API RESTful Stateless)**
   - Localização: `backend/app/`
   - Tecnologia: **Python 3.9+**, framework **FastAPI** e **Pydantic** (validação de schemas).
   - Sem Persistência em Banco: Operação puramente sem estado (stateless), voltada ao processamento matemático e geração em streaming de laudos em PDF e dados CSV.
   - Serviços de Domínio:
     - `report_generator.py`: geração de relatórios técnicos de ensaio experimental em formato PDF de alta fidelidade visual usando `reportlab` e `matplotlib`.
     - `score_service.py`: motor de avaliação e pontuação baseado em métricas de desempenho transitório (Overshoot, Rise Time, Settling Time, IAE, ISE, ITAE).

3. **Infraestrutura e Execução**
   - `docker-compose.yml`: orquestra simultaneamente a API FastAPI (`8081`) e o servidor estático Nginx do frontend (`8080`), sem dependência de banco de dados.
   - `render.yaml`: manifesto oficial de Infraestrutura como Código (Blueprint) para deploy automatizado gratuito na nuvem do Render.

---

## 2. Estrutura de Diretórios e Regras de Versionamento

```text
.
├── backend/                  # Código-fonte da API FastAPI (Stateless)
│   ├── app/
│   │   ├── api/              # Roteamento e endpoints (/api/v1/runs)
│   │   ├── core/             # Configurações globais (config.py)
│   │   ├── schemas/          # Schemas Pydantic para validação de telemetria
│   │   ├── services/         # Regras de negócio (relatórios PDF, score)
│   │   └── main.py           # Ponto de entrada FastAPI
│   ├── tests/                # Testes automatizados com pytest e TestClient
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Código-fonte do cliente Web
│   ├── app/
│   │   ├── css/              # Folhas de estilo (style.css, modal.css)
│   │   ├── js/               # Módulos JavaScript orientados ao objeto window
│   │   │   ├── PhysicsEngine.js      # Integração física, PID e relevo
│   │   │   ├── Scene3D.js            # Renderizador Three.js da pista 3D
│   │   │   ├── LevelManager.js       # Gerenciador de plantas e fases didáticas
│   │   │   ├── ChartAnalytics.js     # Gráficos em tempo real e cálculo de integrais
│   │   │   ├── ChartWindowManager.js # Janela flutuante e destacável dos gráficos
│   │   │   ├── CodeEditor.js         # Integração com o CodeMirror
│   │   │   ├── UIManager.js          # Bindings de interface e persistência via localStorage
│   │   │   └── _archive/             # Implementações legadas de referência
│   │   └── index.html        # Página principal da aplicação
│   └── Dockerfile
├── docker-compose.yml        # Orquestrador local multi-container (FastAPI + Nginx)
├── render.yaml               # Configuração de deploy em produção (Render)
├── .gitignore                # Bloqueio estrito de arquivos locais e de agentes
├── AGENT.md                  # Este guia para agentes de IA
└── README.md                 # Documentação principal para desenvolvedores humanos
```

### Regras Estritas de Versionamento para Agentes

- **Pastas Isoladas e Ignoradas**: Pastas como `.agent-workspace/`, `.agents/`, `.claude/`, `.docs/`, `agent/` e `specs/` são estritamente mantidas fora do Git pelo `.gitignore`.
- Se o agente criar ferramentas de rascunho, planos temporários ou análises de IA, deve salvá-las dentro da pasta oculta `.agent-workspace/`, nunca na raiz do repositório.
- Não introduza arquivos `.env` no Git. As variáveis padrão de desenvolvimento já estão emuladas no `docker-compose.yml`.

---

## 3. Padrões de Código e Convenções do Frontend

### O Estado Global da Simulação (`window.SIM_STATE`)

Toda a dinâmica física e variáveis de estado trafegam pelo objeto reativo `window.SIM_STATE`, inicializado em `PhysicsEngine.js`:

- `position`, `velocity`: coordenadas cinemáticas do atuador/veículo.
- `integral`, `lastError`, `lastTime`, `lastForce`: registradores do algoritmo PID.
- `setPoint`: valor alvo desejado de controle.
- `enableAntiWindup`: booleano que ativa ou desativa o _clamping_ condicional da integral.
- `maxIntegral`: limite de saturação calibrado para a integral (anti-windup).
- `iae`, `ise`, `itae`: integrais cumulativas de erro para cálculo de métricas didáticas.
- `terrainMode`: tipo de relevo (`flat`, `incline`, `decline`, `wave`).
- `disturbance`: perturbação instantânea (ex: força de gravidade na rampa $F_{\text{relevo}} = -m \cdot g \cdot \sin(\alpha)$).

### Loop de Execução e Renderização

- **Física desacoplada**: `PhysicsEngine.js` gerencia o loop com `requestAnimationFrame`, executando integração numérica temporal (Euler explícito com passo calibrado $dt$) e limitando acelerações de acordo com a força máxima do atuador (`maxForce`).
- **Renderização desacoplada**: `Scene3D.js` possui seu próprio ciclo de animação para câmera suave, partículas de fumaça, marcas de frenagem no asfalto e deformação visual do relevo da pista.

---

## 4. Guia Passo a Passo: Como Criar Novas Fases / Plantas Didáticas

Para adicionar uma nova planta didática (ex: Pêndulo Invertido, Tanque de Água, Viga e Esfera, Hovercraft), o agente deve seguir rigorosamente estes passos:

### Passo 1: Modelagem Física e Matemática

Defina a equação diferencial da planta no domínio do tempo e no plano $s$:

- Entrada de controle $u(t)$ (ex: Tensão, Força, Ângulo, Vazão).
- Variável de processo $y(t)$ (ex: Posição, Altura, Nível, Temperatura).
- Perturbações externas $d(t)$ (ex: Gravidade, Vento, Vazamento).

### Passo 2: Registrar a Fase em `frontend/app/js/LevelManager.js`

No dicionário `window.LevelManager.levels`, adicione uma nova chave com a configuração da fase:

```javascript
levels: {
  // Exemplo de nova fase com ID 2
  2: {
    id: 2,
    name: "Sistema de Nível de Tanque",
    subtitle: "Controle de Volume e Vazão de Líquidos",
    difficulty: "INTERMEDIÁRIO",
    difficultyColor: "#008FFB",
    description: "Mantenha o nível do líquido na altura desejada compensando perturbações de vazão.",
    tip: "Ganhos recomendados: <strong>Kp=15.0</strong>, <strong>Ki=0.8</strong>.",
    defaultCode: `// Código padrão para a Fase 2
let kp = 15.0;
let ki = 0.8;
let kd = 20.0;

let vazaoBomba = (kp * error) + (ki * integral) + (kd * derivative);
vazaoBomba = Math.max(0, Math.min(100, vazaoBomba)); // Saturação [0, 100]%
return vazaoBomba;`,
    targetLabel: "Altura Alvo (cm)",
    targetMin: 10,
    targetMax: 100,
    targetStep: 5,
    targetDefault: 60,
    statLabels: {
      pos: "Nível Atual",
      vel: "Vazão Ent.",
      err: "Erro Nível",
      ctrl: "Bomba PWM"
    },
    statUnits: { pos: "cm", vel: "L/s", err: "cm", ctrl: "%" },
    sceneModule: "SceneWaterTank", // Módulo 3D correspondente
    challenge: {
      text: "Desafio: Estabilizar em menos de 8s com erro residual < 1cm",
      check: (metrics) => metrics.settlingTime < 8.0 && Math.abs(metrics.finalError) < 1.0
    }
  }
}
```

No método `activateLevel(levelId)`, inclua as condições para reinicializar as constantes em `window.SIM_STATE` correspondentes à nova planta (massa, área transversal, constantes de atrito/viscosidade).

### Passo 3: Implementar a Dinâmica Física em `PhysicsEngine.js`

No método de passo (`step()` / loop principal) de `PhysicsEngine.js`:

1. Verifique `SIM_STATE.currentLevel`.
2. Calcule a derivada das variáveis de estado com base na entrada $u(t)$ gerada pelo PID.
3. Atualize a variável de saída (`SIM_STATE.position` ou variável análoga) usando integração numérica segura:
   $$x_{k+1} = x_k + v_k \cdot dt$$
   $$v_{k+1} = v_k + \frac{F_{\text{total}}}{m} \cdot dt$$
4. Assegure o suporte ao **Anti-Windup** respeitando a flag `SIM_STATE.enableAntiWindup`.

### Passo 4: Implementar o Módulo de Renderização 3D (`Scene<Nome>.js`)

Crie um arquivo modular em `frontend/app/js/Scene<Nome>.js` (ex: `SceneWaterTank.js`) ou reutilize a arquitetura do `Scene3D.js`:

- O módulo deve expor uma interface uniforme:
  - `init(containerId, setPoint)`: configura cena, câmera ortográfica/perspectiva, iluminação, chão e malhas da planta.
  - `update(simState)`: chamada a cada frame do loop de animação para transladar/rotacionar malhas conforme `simState.position` e `simState.velocity`.
  - `reset()`: redefine as posições visuais iniciais.
  - `destroy()`: cancela o loop de animação (`cancelAnimationFrame`), remove event listeners e limpa geometrias/materiais da memória WebGL.

### Passo 5: Atualizar a Interface do Usuário (`index.html` e `UIManager.js`)

- Importe o script da nova cena no `<head>` ou fim do `index.html`:
  ```html
  <script src="js/SceneWaterTank.js"></script>
  ```
- No `UIManager.js`, garanta que os botões do seletor de fases instanciem e acionem `LevelManager.activateLevel(novoId)`.

### Passo 6: Integração no Backend (Opcional - Persistência e Scoring)

Se a nova fase demandar regras específicas para cálculo de pontuação no ranking:

- Edite `backend/app/services/score_service.py` e adicione critérios de ponderação específicos para o `level_name` da nova fase.
- Edite `backend/app/services/report_generator.py` caso queira diagramas específicos da nova planta nos relatórios PDF.

---

## 5. Como Executar e Validar Localmente

### Opção 1: Execução com Docker (Ambiente Completo)

```bash
docker-compose up --build
```

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8081`
- Swagger Docs: `http://localhost:8081/docs`

### Opção 2: Execução Manual dos Serviços

**Backend (Python):**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081
```

**Frontend (Qualquer servidor HTTP estático):**

```bash
cd frontend/app
python3 -m http.server 8080
```

### Execução dos Testes Automatizados da API

Dentro de `backend/`:

```bash
pytest tests/ -v
```

Os testes validam de forma automatizada e stateless a geração de relatórios PDF com matplotlib/reportlab, o cálculo de score e a exportação CSV.

---

## 6. Boas Práticas para Agentes de IA

1. **Vanilla JS Modular**: Mantenha o padrão de objetos expostos no escopo `window` (`window.LevelManager`, `window.PhysicsEngine`, `window.Scene3D`, etc.), pois isso garante compatibilidade direta sem necessitar de build tools.
2. **Preservar Fidelidade Visual**: A interface utiliza um tema Dark moderno com paleta de alta legibilidade (cores `#00E396` para status ativo, `#008FFB` para sinais de processo, `#FEB019` para referências e `#FF4560` para alertas/erros). Respeite esse padrão em novos componentes visuais.
3. **Robustez de Entrada**: No backend, sempre valide parâmetros de entrada via Schemas Pydantic em `backend/app/schemas/run.py`.
4. **Commits Semânticos**: Use mensagens claras no padrão Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`).
