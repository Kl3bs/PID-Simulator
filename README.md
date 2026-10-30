# PID Simulator: Laboratório Virtual Didático de Sistemas de Controle 3D

O **PID Simulator** é uma plataforma educacional e experimental em três dimensões desenvolvida para o ensino prático de Teoria de Controle Automático. O simulador permite projetar, calibrar e analisar controladores Proporcional-Integral-Derivativo (PID) aplicados a sistemas dinâmicos sujeitos a perturbações externas em tempo real.

O projeto combina simulação física em tempo real, renderização 3D de alta fidelidade visual, telemetria analítica com métricas de desempenho transitório e persistência de ensaios com emissão de relatórios técnicos em PDF.

---

## Sumário

- [Visão Geral e Arquitetura](#visão-geral-e-arquitetura)
- [Funcionalidades Principais](#funcionalidades-principais)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Pré-requisitos e Instalação](#pré-requisitos-e-instalação)
  - [Execução via Docker Compose (Recomendado)](#execução-via-docker-compose-recomendado)
  - [Execução Manual do Backend e Frontend](#execução-manual-do-backend-e-frontend)
- [Endpoints da API](#endpoints-da-api)
- [Testes Automatizados](#testes-automatizados)
- [Guia para Agentes de IA e LLMs](#guia-para-agentes-de-ia-e-llms)
- [Licença](#licença)

---

## Visão Geral e Arquitetura

A aplicação é projetada sob uma arquitetura desacoplada e modular:

- **Frontend (Cliente Web SPA)**:
  - Desenvolvido em Vanilla JavaScript modular (ES6+), dispensando etapas de compilação ou empacotamento (*zero-bundling*).
  - **Three.js (r128)**: renderização 3D acelerada por hardware com iluminação dinâmica, sombras, relevo orgânico e partículas.
  - **Chart.js (v3)**: telemetria gráfica síncrona com curvas de sinal de controle, erro, variável de processo e setpoint.
  - **CodeMirror**: editor de código integrado que possibilita a programação do algoritmo de controle diretamente pelo usuário em JavaScript.
  - **ChartWindowManager**: gerenciador de janela flutuante desacoplável, permitindo redimensionar, mover e destacar os gráficos em pop-up independente.

- **Backend (API RESTful)**:
  - Desenvolvido com **Python 3.9+** e o framework **FastAPI**.
  - **SQLAlchemy ORM** para modelagem de dados e persistência relacional.
  - **PostgreSQL 15+** como banco de dados principal.
  - **ReportLab**: motor dedicado para emissão de relatórios analíticos de ensaios em PDF de alta resolução.

- **Infraestrutura**:
  - `docker-compose.yml`: ambiente pronto para orquestração de banco, backend e servidor HTTP estático (Nginx).
  - `render.yaml`: manifesto oficial de Infrastructure as Code (IaC) para implantação em nuvem pública no Render.

---

## Funcionalidades Principais

1. **Bancada Didática 3D com Relevo Dinâmico**:
   - Controle de posição longitudinal de veículo em pista com inclinações configuráveis (*plana, aclive, declive e ondulada*).
   - Perturbações gravitacionais realistas calculadas dinamicamente: $F_{\text{relevo}} = -m \cdot g \cdot \sin(\alpha)$.

2. **Controle PID e Técnicas de Anti-Windup**:
   - Modos de sintonia via sliders e modo de código aberto para scripts de controle personalizados.
   - Alternância dinâmica entre saturação com e sem *clamping* (*Anti-Windup*), permitindo visualizar o fenômeno de *integrator windup* e sua mitigação prática.

3. **Métricas de Desempenho e Critérios Integrais**:
   - Cálculo automático e instantâneo de métricas temporais clássicas:
     - Sobressinal percentual (*Overshoot* - $M_p$)
     - Tempo de subida (*Rise Time* - $t_r$)
     - Tempo de acomodação (*Settling Time* - $t_s$)
     - Erro de regime permanente (*Steady-State Error* - $e_{ss}$)
   - Critérios integrais de desempenho:
     - IAE (Integral of Absolute Error)
     - ISE (Integral of Square Error)
     - ITAE (Integral of Time-weighted Absolute Error)

4. **Janela Flutuante de Telemetria**:
   - Suporte a arrasto fluido, ancoragem, redimensionamento contínuo com `ResizeObserver` e abertura em pop-up desacoplada.

5. **Exportação de Ensaios e Relatórios Técnicos**:
   - Persistência das rodadas de simulação e séries temporais no banco de dados.
   - Exportação de dados brutos em formato CSV para análise científica externa (MATLAB, Python, Excel).
   - Geração de relatórios técnicos completos em PDF contendo cabeçalho institucional, parâmetros do modelo, gráficos de resposta transitória e diagnóstico de estabilidade.

---

## Estrutura do Repositório

```text
.
├── backend/                  # API REST FastAPI e serviços analíticos
│   ├── app/
│   │   ├── api/              # Endpoints REST e injeção de dependências
│   │   ├── core/             # Configurações de ambiente e projeto
│   │   ├── db/               # Sessão do SQLAlchemy e migração de tabelas
│   │   ├── models/           # Modelos de banco de dados (User, Run)
│   │   ├── schemas/          # Schemas Pydantic de requisição e resposta
│   │   ├── services/         # Emissão de PDF (report_generator) e scoring
│   │   └── main.py           # Instanciação da aplicação FastAPI
│   ├── tests/                # Suíte de testes automatizados com pytest
│   ├── Dockerfile            # Containerização da API
│   └── requirements.txt      # Dependências Python
├── frontend/                 # Aplicação Web SPA
│   ├── app/
│   │   ├── css/              # Estilização da interface e janelas modais
│   │   ├── js/               # Módulos JavaScript (física, 3D, UI, gráficos)
│   │   └── index.html        # Estrutura HTML da bancada didática
│   └── Dockerfile            # Imagem Nginx para servir os arquivos estáticos
├── docker-compose.yml        # Orquestrador local multi-serviço
├── render.yaml               # Configuração declarativa de deploy no Render
├── AGENT.md                  # Especificação técnica para modelos de linguagem / agentes
└── README.md                 # Este documento
```

---

## Pré-requisitos e Instalação

### Execução via Docker Compose (Recomendado)

Certifique-se de ter o Docker e o Docker Compose instalados em sua máquina.

1. Clone o repositório:
   ```bash
   git clone https://github.com/Kl3bs/PID-Simulator.git
   cd PID-Simulator
   ```

2. Inicialize todos os serviços:
   ```bash
   docker-compose up --build
   ```

3. Acesse no navegador:
   - **Frontend (Simulador)**: [http://localhost:8080](http://localhost:8080)
   - **Backend (Documentação Swagger)**: [http://localhost:8081/docs](http://localhost:8081/docs)

---

### Execução Manual do Backend e Frontend

Caso prefira executar os serviços nativamente sem Docker:

#### 1. Backend (Python + FastAPI)

1. Entre no diretório do backend e configure o ambiente virtual:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # No Windows: venv\Scripts\activate
   ```

2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

3. Inicie o servidor FastAPI (certifique-se de ter um PostgreSQL ativo ou configure a variável `DATABASE_URL`):
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8081
   ```

#### 2. Frontend

O cliente é puramente estático. Você pode servi-lo com qualquer servidor HTTP:
```bash
cd frontend/app
python3 -m http.server 8080
```
Em seguida, acesse [http://localhost:8080](http://localhost:8080).

---

## Endpoints da API

A API oferece rotas REST sob o prefixo `/api/v1/runs`:

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/v1/runs/` | Registra uma nova rodada de simulação com métricas e série temporal |
| `GET` | `/api/v1/runs/` | Lista o histórico recente de ensaios com paginação |
| `GET` | `/api/v1/runs/leaderboard` | Retorna o ranking dos melhores desempenhos por fase |
| `GET` | `/api/v1/runs/{id}` | Retorna os detalhes de um ensaio específico |
| `GET` | `/api/v1/runs/{id}/export-csv` | Exporta a série temporal completa do ensaio em CSV |
| `GET` | `/api/v1/runs/{id}/export-pdf` | Gera e transmite o relatório técnico completo em PDF |

Documentação interativa completa disponível via Swagger UI em `/docs` e ReDoc em `/redoc`.

---

## Testes Automatizados

A suíte de testes do backend utiliza `pytest` em conjunto com SQLite em memória para isolamento completo:

```bash
cd backend
pytest tests/ -v
```

Os testes cobrem:
- Criação e validação de rodadas de simulação.
- Cálculo de pontuação e métricas analíticas.
- Exportação correta de fluxos de dados em CSV.
- Geração íntegra de arquivos PDF via ReportLab.

---

## Guia para Agentes de IA e LLMs

Para desenvolvedores utilizando assistentes de código de inteligência artificial (como Claude Code, Cursor, Copilot, Antigravity ou Devin), consulte o arquivo [AGENT.md](AGENT.md). Ele contém detalhes sobre convenções do loop de física, manipulação do estado global `SIM_STATE` e o tutorial passo a passo para criação de novas fases e plantas de controle.

---

## Licença

Este projeto é desenvolvido para fins acadêmicos e educacionais como parte de Trabalho de Conclusão de Curso (TCC). Consulte o autor para termos específicos de uso e contribuição.

