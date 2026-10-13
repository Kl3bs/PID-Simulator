# 🎓 Guia Definitivo de Apresentação e Revisão do TCC
## Engenharia de Computação — UFAL

> **Título:** *Desenvolvimento de uma Plataforma Web Interativa com Simulação Física 3D para Ensino, Sintonia e Análise de Desempenho de Controladores PID*  
> **Autor:** Kleber Vasconcelos  
> **Objetivo deste documento:** Servir como seu "mapa mental" completo para a defesa da banca examinadora. Tudo o que você precisa saber, explicar e responder está mastigado e explicado de forma simples, direta e intuitiva aqui.

---

# 📑 ÍNDICE RÁPIDO
1. [O "Elevator Pitch" (Como resumir o TCC em 1 minuto)](#1-o-elevator-pitch-como-resumir-o-tcc-em-1-minuto)
2. [Conceitos Fundamentais de Controle (Sem Enrolação)](#2-conceitos-fundamentais-de-controle-sem-enrola%C3%A7%C3%A3o)
   - [Malha Aberta vs. Malha Fechada](#21-malha-aberta-vs-malha-fechada)
   - [O que é o Erro?](#22-o-que-%C3%A9-o-sinal-de-erro)
   - [As 3 Ações: P, I e D explicadas na prática](#23-as-tr%C3%AAs-a%C3%A7%C3%B5es-p-i-e-d-explicadas-na-pr%C3%A1tica)
   - [Métricas do Gráfico (O que a banca vai te perguntar)](#24-m%C3%A9tricas-do-gr%C3%A1fico-transit%C3%B3rio-e-regime)
   - [Saturação e Efeito Windup](#25-satura%C3%A7%C3%A3o-e-efeito-integrator-windup)
3. [Sintonia de Controladores (Ziegler-Nichols & FOPDT)](#3-sintonia-de-controladores-como-o-assistente-funciona)
4. [A Física das Três Fases no Simulador](#4-a-f%C3%ADsica-das-tr%C3%AAs-fases-no-simulador)
5. [Arquitetura de Computação (O lado "Engenharia de Computação")](#5-arquitetura-de-computa%C3%A7%C3%A3o-o-lado-software)
6. [Roteiro de Apresentação Slide a Slide (15 a 20 minutos)](#6-roteiro-de-apresenta%C3%A7%C3%A3o-slide-a-slide)
7. [Guia de Respostas para Perguntas "Pegadinha" da Banca](#7-perguntas-cl%C3%A1ssicas-da-banca-e-como-responder)

---

# 1. O "Elevator Pitch" (Como resumir o TCC em 1 minuto)

Se a banca ou alguém perguntar: *"Kleber, em poucas palavras, qual é o seu TCC?"*:

> *"Meu TCC desenvolveu um **Laboratório Virtual Web** para o ensino prático de Sistemas de Controle. O ensino tradicional de controle é muito focado em matemática abstrata (Laplace, polos e zeros), enquanto as ferramentas práticas como MATLAB são caras e pesadas.  
> Criei uma plataforma 100% no navegador onde o estudante escreve código PID real em JavaScript, enxerga a física do sistema reagindo em **3D com Three.js** (um carro em pista com aclive, drone com vento ou navio com ondas), analisa a telemetria com **decomposição das forças P, I e D** no osciloscópio, realiza **sintonia clássica automática por Ziegler-Nichols** e exporta **relatórios em PDF e dados em CSV** gerados por um backend em FastAPI/Docker."*

---

# 2. Conceitos Fundamentais de Controle (Sem Enrolação)

### 2.1 Malha Aberta vs. Malha Fechada
- **Malha Aberta:** O atuador aplica uma força sem olhar para o resultado. Exemplo: Você pisa no acelerador até a metade e não olha o velocímetro. Se vier uma subida, o carro perde velocidade.
- **Malha Fechada (*Feedback*):** O sistema mede continuamente a saída ($y(t)$), compara com a meta ($r(t)$) e calcula a força necessária para corrigir o desvio.

### 2.2 O que é o Sinal de Erro?
$$e(t) = r(t) - y(t)$$
- $r(t)$ = **Setpoint (Meta)** (Ex: Posição $600\text{ m}$ ou Velocidade $80\text{ km/h}$).
- $y(t)$ = **Variável de Processo (PV)** (Onde o veículo realmente está no momento).
- $e(t)$ = **Erro** (A distância ou diferença entre onde estou e onde quero chegar).

---

### 2.3 As Três Ações: P, I e D explicadas na prática

O esforço total de controle é a soma das três componentes:
$$u(t) = u_P(t) + u_I(t) + u_D(t)$$

| Ação | Fórmula Contínua | Fórmula Discreta (Código) | O que faz no mundo real? | Analogia do Carro |
| :---: | :---: | :---: | :--- | :--- |
| **P** *(Proporcional)* | $u_P = K_p \cdot e(t)$ | `Kp * error` | **Olha para o PRESENTE.** Quanto maior o erro agora, maior a força aplicada. | Quanto mais longe você está da vaga de estacionamento, mais você pisa no acelerador. |
| **I** *(Integral)* | $u_I = K_i \int e(\tau) d\tau$ | `Ki * integral` | **Olha para o PASSADO (Memória).** Acumula o erro ao longo do tempo para eliminar o erro que o P não consegue vencer. | O carro parou numa subida e o P não dá conta do atrito. O I percebe que o carro está parado há tempo e vai aumentando a força até o carro subir. |
| **D** *(Derivativo)* | $u_D = K_d \frac{de(t)}{dt}$ | `Kd * derivative` | **Olha para o FUTURO (Previsão).** Funciona como um **freio dinâmico** que amortece o movimento se você estiver se aproximando rápido demais da meta. | Você está chegando perto da vaga rápido demais; antes de bater, você pisa no freio para suavizar a parada. |

#### ⚠️ Detalhe Crítico que a Banca AMA perguntar:
**"Por que só o ganho Proporcional (P) não consegue zerar o erro numa rampa?"**
- **Resposta:** Porque para o termo Proporcional gerar força, ele precisa de erro ($u_P = K_p \cdot e$). Se o erro chegasse a zero, a força do motor viraria zero e o carro desceria a rampa pela gravidade! O sistema estabiliza quando a força proporcional iguala o peso na rampa, restando um **erro em regime permanente ($e_{ss} \neq 0$)**. Para zerar esse erro, é **obrigatório** ter a ação Integral ($I$).

---

### 2.4 Métricas do Gráfico (Transitório e Regime)

Quando você aplica um degrau (muda a meta de 0 para 600), o sistema passa por duas fases:
1. **Fase Transitória:** A saída sai do repouso e tenta alcançar a meta (acelera, pode ultrapassar, oscila).
2. **Regime Permanente:** Quando o sistema estabiliza após as oscilações.

```
       Posição y(t)
          ▲            _.-""-._   <--- Pico Máximo (Pico do Overshoot)
          │          .'        `.
Setpoint  ├ - - - - / - - - - - -`._ - - - - - - - - - - (Meta desejada)
          │        /                `'-._          _.-
          │       /                      `--------'      <--- Faixa de ±2% (Settling Time)
          │      /
          │     / 
          │    /  <--- Subida Rápida (Rise Time)
          └───┴─────────────────────────────────────────► Tempo (s)
```

1. **Tempo de Subida ($t_r$ — *Rise Time*):** Tempo que o sistema leva para sair de 10% e atingir 90% da meta. Quanto menor, mais ágil o sistema.
2. **Sobressinal / *Overshoot* ($M_p$):** O quanto o carro passou além da meta antes de frear, em porcentagem.
   $$M_p = \frac{y_{\max} - y_{\text{final}}}{y_{\text{final}}} \times 100\%$$
   *(Exemplo: Se a meta é 600m e o carro foi até 720m, o overshoot foi de 20%).*
3. **Tempo de Acomodação ($t_s$ — *Settling Time*):** Tempo total para a oscilação parar e o carro ficar definitivamente dentro de uma margem de $\pm 2\%$ ou $\pm 5\%$ da meta.
4. **Erro em Regime Permanente ($e_{ss}$):** A diferença que sobrou no final ($e_{ss} = r - y$). O ideal é $e_{ss} = 0$.
5. **RMSE (*Root Mean Square Error*):** O erro quadrático médio em todo o ensaio. Quanto menor o RMSE, mais perfeita foi a trajetória.

---

### 2.5 Saturação e Efeito *Integrator Windup*
- **Saturação:** Motores reais têm limites de força (ex: potência máxima de $-100$ a $+100$).
- **O Efeito *Windup*:** Se a meta estiver longe e o motor já estiver em 100% de força, o termo Integral continuará somando erro loucamente na memória (`integral += error * dt`). Quando o carro finalmente alcança a meta, o integrador está "gigante" e continua mandando 100% de força para frente. O carro passa direto da meta com um overshoot enorme!
- **Como solucionar (*Anti-Windup*):** Técnica de *Clamping* (trava condicional) — quando o motor atinge 100%, você congela a soma da integral para ela não crescer descontroladamente.

---

# 3. Sintonia de Controladores: Como o Assistente Funciona?

Sintonizar um PID significa descobrir os valores certos de $K_p$, $K_i$ e $K_d$.

### O Método da Curva de Reação (Ziegler-Nichols em Malha Aberta)
Em vez de tentar no "chute", o assistente do seu simulador faz o ensaio clássico de malha aberta:
1. **O ensaio:** Aplica um degrau de força constante no motor ($u = 1.0$) sem controle em malha fechada.
2. **A resposta em "S" (Sigmoide):** O carro começa devagar, ganha aceleração e estabiliza em uma velocidade máxima de equilíbrio.
3. **Aproximação FOPDT (*First Order Plus Dead Time*):**
   $$G(s) = \frac{K \cdot e^{-\theta s}}{\tau s + 1}$$
   - **$K$ (Ganho Estático):** A variação de velocidade final dividida pela força aplicada ($\Delta y / \Delta u$).
   - **$\theta$ (Tempo Morto / Atraso):** O atraso inicial até a reação começar a acontecer.
   - **$\tau$ (Constante de Tempo):** O tempo que o sistema leva para atingir 63.2% da velocidade final.
4. **O cálculo dos ganhos:** Ziegler e Nichols criaram tabelas analíticas comprovadas:
   - $K_p = 1.2 \frac{\tau}{K \theta}$
   - $K_i = \frac{K_p}{2.0 \theta}$
   - $K_d = K_p (0.5 \theta)$
5. **O diferencial do seu software:** Com um clique em **"Aplicar no Editor"**, o sistema injeta esses valores diretamente no código JavaScript do estudante!

---

# 4. A Física das Três Fases no Simulador

| Fase | Sistema | Equação Física | Perturbação Dinâmica | Desafio Pedagógico |
| :---: | :---: | :---: | :---: | :--- |
| **Fase 1** | **Carro na Pista** | $m \ddot{x} + b \dot{x} = u(t) + F_{\text{relevo}}$ | **Relevo 3D:** Aclives (+15°), Declives (-15°) ou Pista Ondulada: $F_{\text{relevo}} = -m g \sin(\alpha)$ | Provar que só o termo $P$ falha na rampa e que a ação $I$ é essencial para anular a gravidade. |
| **Fase 2** | **Ball and Beam** | $\ddot{x} = \frac{5}{7} g \alpha(t) - \frac{b_r}{m_b} \dot{x}$ | **Desbalanceamento:** Impulso repentino de inclinação na barra. | Sistema instável (duplo integrador $1/s^2$); a ação Derivativa ($D$) é mandatória para não derrubar a bola. |
| **Fase 3** | **Tanque de Nível** | $A \frac{dh}{dt} = q_{\text{in}} - a_{\text{out}}\sqrt{2gh}$ | **Vazamento de Demanda:** Torneira de vazamento aberta na base. | Processo industrial clássico de 1ª ordem com assimetria de bomba ($q_{\text{in}} \ge 0$) e sintonia Ziegler-Nichols. |

### Integração Numérica: Por que Euler Explícito?
No arquivo `PhysicsEngine.js`, a cada quadro de animação ($\Delta t \approx 16.6\text{ ms}$ a 60 FPS):
1. $\text{Aceleração: } a[k] = \frac{F_{\text{total}} - b \cdot v[k-1]}{m}$
2. $\text{Velocidade: } v[k] = v[k-1] + a[k] \cdot \Delta t$
3. $\text{Posição: } x[k] = x[k-1] + v[k] \cdot \Delta t$
- **Trava de Segurança:** O código satura $\Delta t \le 0.1\text{ s}$ para que o cálculo não exploda se a aba do navegador for minimizada!

---

# 5. Arquitetura de Computação (O lado Software)

A banca de **Engenharia de Computação** vai querer ver a engenharia de software do projeto. Destaque estes pontos:

```
┌────────────────────────────────────────────────────────┐
│                   CLIENTE (Navegador)                  │
│  ┌──────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │  CodeMirror  │──▶│  Sandbox JS │──▶│PhysicsEngine│  │
│  │ (Editor Web) │   │(newFunction)│   │ (Euler 60fps│  │
│  └──────────────┘   └─────────────┘   └──────┬──────┘  │
│                                              │         │
│         ┌────────────────────────────────────┴─────┐   │
│         ▼                                          ▼   │
│  ┌──────────────┐                           ┌───────────┐
│  │ Three.js 3D  │                           │ Chart.js  │
│  │ (WebGL/GPU)  │                           │(Oscilosc.)│
│  └──────────────┘                           └───────────┘
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /runs (JSON assíncrono)
                            ▼
┌────────────────────────────────────────────────────────┐
│               BACKEND (Python / Docker)                │
│  ┌──────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │   FastAPI    │──▶│ScoreService │──▶│ReportGen.py │  │
│  │  (REST API)  │   │(Diagnóstico)│   │ (PDF / CSV) │  │
│  └──────┬───────┘   └─────────────┘   └─────────────┘  │
│         ▼                                              │
│  ┌──────────────┐                                      │
│  │ PostgreSQL / │                                      │
│  │ SQLAlchemy   │                                      │
│  └──────────────┘                                      │
└────────────────────────────────────────────────────────┘
```

1. **Separação de Responsabilidades:**
   - **Cliente (Frontend):** Roda a simulação física pesada a 60 FPS e o Three.js direto na placa de vídeo do usuário (GPU) via WebGL. O servidor não sofre processando física de dezenas de alunos simultâneos.
   - **Servidor (Backend):** Focado em persistência, validação com Pydantic v2, inteligência diagnóstica e geração de relatórios PDF de alta qualidade via ReportLab e Matplotlib.
2. **Execução Segura de Código (Sandbox Client-Side):**
   - O código do aluno é executado via `new Function(...)` com variáveis restritas (`error`, `integral`, `derivative`, etc.).
   - O código é cercado por blocos `try/catch`. Se o aluno escrever bobagem, dividir por zero ou der erro de sintaxe, o simulador não quebra: a animação pausa e uma mensagem amigável é exibida no painel de erro.
3. **Portabilidade Máxima:**
   - Conteinerizado em **Docker** (`docker compose up --build`). Roda em Linux, Mac ou Windows sem incompatibilidade de versões de Python ou bibliotecas.

---

# 6. Roteiro de Apresentação Slide a Slide

Sugerido para uma apresentação de **15 a 20 minutos**:

### Slide 1: Título e Identificação (1 min)
- Seu nome, curso (Engenharia de Computação / UFAL), orientador e título do trabalho.

### Slide 2: Motivação e O Problema (2 min)
- **A dor:** Sistemas de controle têm disciplinas com alta taxa de reprovação por excesso de abstração matemática.
- **As barreiras:** MATLAB/Simulink é caro e pesado; bancadas físicas são caras e quebram; simuladores web existentes são 2D e usam apenas *sliders*.
- **A pergunta da pesquisa:** Como criar uma plataforma web leve, 3D, aberta e interativa onde o estudante programa de verdade?

### Slide 3: Objetivos do Trabalho (1.5 min)
- **Objetivo Geral:** Desenvolver a plataforma web com simulação 3D, editor com sandbox, osciloscópio com decomposição e módulo de sintonia.
- **Objetivos Específicos:** Modelagem física, WebGL/Three.js, API FastAPI, ensaio de Ziegler-Nichols e validação experimental.

### Slide 4: Fundamentação: O que é o PID? (2 min)
- Explicar rapidamente os 3 blocos: Proporcional (presente), Integral (passado/anula erro), Derivativo (futuro/amortece).
- Explicar o que é $t_r$, $t_s$, $M_p$ e $e_{ss}$ (mostrar que o simulador mede tudo isso automaticamente).

### Slide 5: Arquitetura da Solução (2 min)
- Mostrar o diagrama em blocos (Frontend Three.js + PhysicsEngine $\leftrightarrow$ Backend FastAPI + ReportLab + Docker).
- Explicar por que a física roda no cliente (escalabilidade e zero latência) e o backend cuida dos relatórios.

### Slide 6: As Três Fases e Modelagem Física (2 min)
- Fase 1 (Carro com aclive/declive e forças gravitacionais).
- Fase 2 (Drone sob vento estocástico).
- Fase 3 (Navio de grande inércia com ondas marítimas).

### Slide 7: Inovações Didáticas da Plataforma (2.5 min)
- **1. Decomposição de Forças no Osciloscópio:** Ver a curva do $u_P$, $u_I$ e $u_D$ separadamente com toggles visuais.
- **2. Assistente de Sintonia:** Ensaio em malha aberta com um clique, cálculo dos ganhos e injeção no editor.
- **3. Relatórios Automáticos:** Geração de laudo PDF com diagnóstico técnico de ajuste e download de CSV.

### Slide 8: Resultados Experimentais e Validação (3 min)
- **Validação com modelo analítico:** O motor numérico teve erro médio de apenas $\text{RMSE} = 0.018\text{ m/s}$ frente à solução exata do SciPy.
- **Comparativo P vs PI vs PID:** Mostrar que o P sozinho teve erro na rampa, o PI zerou o erro mas deu overshoot de 28%, e o PID reduziu o overshoot para 4% e o tempo de acomodação em 56%.
- **Desempenho:** Aplicação estável a 59.4 FPS com apenas 42 MB de memória no navegador.

### Slide 9: Demonstração Rápida / Live Demo (3 min)
- Abrir o navegador em `localhost:8080`, rodar o simulador, mostrar o carro subindo a rampa, abrir o modal de sintonia e gerar um PDF.

### Slide 10: Conclusão e Trabalhos Futuros (1.5 min)
- Objetivos atingidos com sucesso;
- Plataforma pronta para uso didático nas turmas de Engenharia da UFAL;
- Próximos passos: Web Workers e integração com microcontroladores (*Hardware-in-the-Loop*).

---

# 7. Perguntas Clássicas da Banca e Como Responder

### ❓ Pergunta 1: *"Por que você usou o método de Euler e não Runge-Kutta de 4ª ordem (RK4) para integrar as equações?"*
> **Sua Resposta:** *"Como a simulação é acoplada ao laço gráfico de animação (`requestAnimationFrame`) que atualiza a tela a 60 FPS, o passo de integração temporal é extremamente diminuto ($\Delta t \approx 16{,}6\text{ ms}$). Nossos testes comparativos frente à solução analítica contínua do SciPy comprovaram um erro quadrático médio de apenas $0{,}018\text{ m/s}$ (menos de 0,08% de desvio). O método de Euler supriu plenamente o rigor pedagógico com um custo computacional ínfimo, garantindo que o navegador não perdesse quadros."*

### ❓ Pergunta 2: *"E se o estudante escrever um laço infinito como `while(true)` no editor de código? O navegador vai travar?"*
> **Sua Resposta:** *"O editor foi protegido com isolamento de escopo via `new Function` e blocos de captura de exceção. Erros de sintaxe ou retorno de valores inválidos (`NaN` ou indefinidos) são interceptados imediatamente e a simulação é pausada com feedback no console de diagnóstico. Para trabalhos futuros, planejamos migrar a execução para **Web Workers**, o que permitirá estipular um temporizador de *timeout* capaz de abortar laços infinitos em threads separadas sem travar a interface."*

### ❓ Pergunta 3: *"Por que o sinal de saturação e o anti-windup são importantes em um simulador educacional?"*
> **Sua Resposta:** *"Porque em softwares teóricos puramente lineares, o atuador tem força infinita, o que não existe no mundo real. Motores saturam. Quando o atuador satura e o controlador continua integrando o erro, ocorre o fenômeno de Integrator Windup, gerando sobreoscilações severas e instabilidade. Mostrar a linha de saturação no osciloscópio e ensinar o estudante a criar lógica anti-windup conecta a teoria à prática da indústria."*

### ❓ Pergunta 4: *"Qual é o real diferencial deste trabalho em relação ao MATLAB ou simuladores web gratuitos que já existem?"*
> **Sua Resposta:** *"O MATLAB exige licenças caras, computadores potentes e uma curva de aprendizado complexa de operação. Já os simuladores web existentes na internet são quase todos em 2D e limitados a mexer em 'sliders' pré-configurados. O **PID Simulator** une o melhor dos dois mundos: é gratuito e roda no navegador sem instalação, permite que o aluno escreva o código do algoritmo em JavaScript, oferece visualização física 3D realista com relevo e perturbações e decompõe graficamente as forças $u_P, u_I, u_D$ em tempo real."*

---

### 💡 Dicas de Ouro para a Apresentação:
1. **Fale com calma:** Você construiu o projeto, você conhece a tela, você sabe o que cada botão faz.
2. **Mostre segurança no osciloscópio:** Saber apontar no gráfico onde está o *overshoot* e o *tempo de subida* causa uma excelente impressão na banca.
3. **Tenha o simulador já aberto em uma aba:** Antes de começar a falar, deixe o Docker rodando e a página `http://localhost:8080` já carregada para evitar imprevistos de internet.
