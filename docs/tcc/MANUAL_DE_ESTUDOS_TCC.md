# 📖 Caderno de Estudos para Defesa do TCC
## Engenharia de Computação — Universidade Federal de Alagoas (UFAL)

> **Tema:** Desenvolvimento de uma Plataforma Web Interativa com Simulação Física 3D para Ensino, Sintonia e Análise de Desempenho de Controladores PID  
> **Autor:** Kleber Vasconcelos  
> **Propósito deste caderno:** Explicar todos os conceitos de Sistemas de Controle e da arquitetura do seu software do **básico absoluto** ao nível exigido pela banca, com linguagem clara, analogias intuitivas, esquemas visuais e simulado de perguntas e respostas.

---

# 📑 Sumário de Estudos
- [Módulo 1: O que é Controle Automático e Malha Fechada?](#módulo-1-o-que-é-controle-automático-e-malha-fechada)
- [Módulo 2: O Controlador PID Dissecado (P, I e D)](#módulo-2-o-controlador-pid-dissecado-p-i-e-d)
- [Módulo 3: Como Interpretar o Gráfico de Telemetria (Transitório e Regime)](#módulo-3-como-interpretar-o-gráfico-de-telemetria)
- [Módulo 4: Não-Linearidades Reais: Saturação e Integrator Windup](#módulo-4-não-linearidades-reais-saturação-e-integrator-windup)
- [Módulo 5: Sintonia de Controladores e o Método de Ziegler-Nichols](#módulo-5-sintonia-de-controladores-e-o-método-de-ziegler-nichols)
- [Módulo 6: A Física das 3 Plantas no Simulador](#módulo-6-a-física-das-3-plantas-no-simulador)
- [Módulo 7: A Engenharia de Computação por Trás da Aplicação](#módulo-7-a-engenharia-de-computação-por-trás-da-aplicação)
- [Módulo 8: Simulado de Autoavaliação (10 Perguntas e Respostas Rápidas)](#módulo-8-simulado-de-autoavaliação-flashcards)

---

# MÓDULO 1: O que é Controle Automático e Malha Fechada?

## 1.1 O Conceito Central
Controlar um sistema significa **forçar uma variável física a seguir um valor desejado**, mesmo quando o ambiente tenta atrapalhar.

### O Exemplo do Chuveiro Elétrico
Imagine que você entra no banho:
1. **Setpoint ($r$ — Meta):** A temperatura que você quer sentir na pele (ex: $38^\circ\text{C}$).
2. **Variável de Processo ($y$ — Realidade):** A temperatura real da água no momento (ex: $30^\circ\text{C}$).
3. **Erro ($e$):** A diferença entre o que você quer e o que tem agora:
   $$e(t) = r(t) - y(t) = 38 - 30 = 8^\circ\text{C}$$
4. **Controlador:** O seu cérebro, que percebe o erro e decide o que fazer.
5. **Atuador:** A sua mão girando o registro para esquentar.
6. **Sinal de Controle ($u$):** A posição do registro (quanta energia/vazão é liberada).
7. **Perturbação Externa ($d$):** Alguém abre a torneira da pia da cozinha, diminuindo a pressão da água fria repentinamente.

---

## 1.2 Malha Aberta vs. Malha Fechada

```
MALHA ABERTA:
[Entrada] ──▶ [Controlador] ──▶ [Atuador / Planta] ──▶ [Saída (Sem medição)]

MALHA FECHADA (FEEDBACK):
[Meta: r(t)] ──▶ ( + ) ──[Erro: e(t)]──▶ [Controlador PID] ──▶ [Atuador / Planta] ──▶ [Saída: y(t)]
                  ▲ ( - )                                              │
                  └─────────────────── [Sensor de Medição] ────────────┘
```

- **Malha Aberta:** Não mede a saída. O comando é fixo. Se você colocar um tijolo no acelerador de um carro a 50%, ele andará a uma velocidade no plano, mas perderá velocidade se vier uma rampa, porque ninguém está olhando o velocímetro para corrigir.
- **Malha Fechada:** **Mede a saída continuamente e compara com a meta**. Se vier uma subida, o velocímetro detecta que a velocidade caiu, o erro aumenta e o algoritmo acelera mais para compensar.
- **No seu TCC:** O sistema é **100% em malha fechada**. A posição do carro/drone/navio é lida 60 vezes por segundo para recalcular a força do motor.

---

# MÓDULO 2: O Controlador PID Dissecado (P, I e D)

O sinal total de atuação é a soma algébrica das três forças:
$$u(t) = u_P(t) + u_I(t) + u_D(t)$$

```
                                  ┌─▶ [ Ação P: Kp * e ] ──────────┐
                                  │                                │
[Erro: e(t)] ──┬──────────────────┼─▶ [ Ação I: Ki * ∫ e dt ] ─────┼──▶ [ u(t) = P + I + D ]
               │                  │                                │
               │                  └─▶ [ Ação D: Kd * de/dt ] ──────┘
```

---

## 2.1 Ação Proporcional ($P$): O "Presente"
- **Equação:** $u_P(t) = K_p \cdot e(t)$
- **No código JavaScript:** `const up = Kp * error;`
- **Conceito:** A força é proporcional ao tamanho do erro **agora**.
  - Erro grande $\rightarrow$ Força grande.
  - Erro pequeno $\rightarrow$ Força pequena.
- **Vantagem:** Dá velocidade de arrancada e agilidade ao sistema.
- **Limitação Fatal (O Erro de Regime):**  
  Se houver atrito ou rampa, a ação Proporcional **nunca consegue zerar o erro sozinha**.  
  *Por quê?* Porque para gerar força, ela precisa de erro ($u_P = K_p \cdot e$). Conforme o carro chega perto da meta, o erro vai ficando pequeno e a força do motor vai caindo, até que a força do motor fica exatamente igual à força de atrito ou ao peso na rampa. O carro empaca antes de chegar na meta! Esse desvio permanente é o **Erro em Regime Permanente ($e_{ss} \neq 0$)**.

---

## 2.2 Ação Integral ($I$): O "Passado / Memória"
- **Equação:** $u_I(t) = K_i \int_{0}^{t} e(\tau) \, d\tau$
- **No código JavaScript:** `integral += error * dt; const ui = Ki * integral;`
- **Conceito:** Acumula o histórico do erro ao longo do tempo.
  - Se o carro empacar a $2\text{ metros}$ da meta, o termo $P$ desiste porque o erro é pequeno.
  - Mas o termo $I$ percebe que o erro continua existindo segundo após segundo. A integral vai somando e aumentando a força continuamente até vencer o atrito/rampa e empurrar o carro exatamente para a meta.
- **Vantagem:** **Zera o erro em regime permanente ($e_{ss} = 0$)** e rejeita perturbações de carga constante.
- **Desvantagem:** Pode causar **Sobressinal (*Overshoot*)**, pois o integrador chega embalado na meta com muita força acumulada e passa direto.

---

## 2.3 Ação Derivativa ($D$): O "Futuro / Previsão / Freio"
- **Equação:** $u_D(t) = K_d \cdot \frac{de(t)}{dt}$
- **No código JavaScript:** `const derivative = (error - lastError) / dt; const ud = Kd * derivative;`
- **Conceito:** Olha a **velocidade com que o erro está diminuindo**.
  - Se o carro estiver voando em direção à meta a toda velocidade, a derivada do erro é negativa ($\frac{de}{dt} < 0$).
  - O termo $D$ multiplica essa velocidade negativa pelo ganho $K_d$, gerando uma força contrária ao movimento.
- **Analogia:** Funciona como um **amortecedor** ou um motorista que pisa no freio antecipadamente antes de bater na vaga de garagem.
- **Vantagem:** Reduz drasticamente o sobressinal (*overshoot*), estabiliza oscilações e diminui o tempo de acomodação.
- **Cuidado:** A derivada é extremamente sensível a ruídos de alta frequência.

---

## 2.4 Resumo das Três Ações

| Ação | Olha para... | Principal Função | Efeito Colateral se for exagerado |
| :---: | :---: | :--- | :--- |
| **P** | O Presente | Acelerar o sistema e reduzir o erro inicial. | Oscilações e incapacidade de zerar o erro com atrito. |
| **I** | O Passado | **Zerar o erro final ($e_{ss} = 0$)** e vencer rampas. | Causa sobressinal (*overshoot*) e lentidão transitória. |
| **D** | O Futuro | **Amortecer o movimento** (funciona como freio dinâmico). | Amplifica ruídos e trepidações. |

---

# MÓDULO 3: Como Interpretar o Gráfico de Telemetria

Na apresentação, você vai apontar para o gráfico do osciloscópio (`Chart.js`). A banca vai querer saber se você reconhece cada curva e métrica:

```
 Posição y(t)
    ▲
    │                  Pico Máximo (y_max)
    │                  ╭──────╮  <--- Sobressinal (Overshoot: Mp)
700 ┼ - - - - - - - - ╭╯ - - - ╰─╮
600 ┼- - - - - - - - ╭╯ - - - - - ╰─────────── Setpoint r(t) = 600m
    │               ╭╯             Faixa ±2% (Tempo de Acomodação: ts)
    │              ╭╯
    │             ╭╯
    │            ╭╯ 
    │       (Rise Time: tr)
  0 ┴───────────┴─────────────────────────────► Tempo (s)
```

### As 5 Métricas Obrigatórias:

1. **Tempo de Subida ($t_r$ — *Rise Time*):**
   - **O que é:** O tempo necessário para a saída sair de 10% e atingir 90% da meta.
   - **Significado:** Mostra a rapidez de resposta do carro na arrancada.
2. **Sobressinal / *Overshoot* ($M_p$):**
   - **O que é:** O percentual que a saída ultrapassou além da meta.
   - **Fórmula:** $M_p = \frac{y_{\max} - y_{\text{meta}}}{y_{\text{meta}}} \times 100\%$
   - *Exemplo da sua tela:* Se a meta é $600\text{ m}$ e o pico máximo foi $660\text{ m}$, o sobressinal foi de $\frac{60}{600} \times 100\% = 10\%$.
3. **Tempo de Acomodação ($t_s$ — *Settling Time*):**
   - **O que é:** O tempo total que o sistema levou para parar de oscilar e ficar definitivamente dentro de uma faixa de tolerância de $\pm 2\%$ da meta.
4. **Erro em Regime Permanente ($e_{ss}$ — *Steady-State Error*):**
   - **O que é:** A diferença residual entre a meta e a posição final quando o tempo tende ao infinito ($e_{ss} = r - y(\infty)$).
5. **RMSE (*Root Mean Square Error*):**
   - **O que é:** Raiz do erro quadrático médio sobre todo o trajeto. Mensura a qualidade global do rastreamento.

---

# MÓDULO 4: Não-Linearidades Reais: Saturação e Integrator Windup

## 4.1 Saturação do Atuador
Nenhum motor real tem força infinita. No simulador, o motor tem limites físicos:
$$u_{\text{sat}} = \text{clip}(u, -u_{\max}, +u_{\max})$$

## 4.2 O Fenômeno de *Integrator Windup*
- Se a meta estiver distante e o motor já estiver em 100% de esforço, a física não consegue andar mais rápido do que a potência máxima permite.
- Enquanto isso, o termo Integral continua somando erro no código a cada quadro:
  $$\text{integral} = \text{integral} + \text{erro} \times \Delta t$$
- O integrador fica "carregado" como uma mola super esticada.
- Quando o carro finalmente alcança a meta, o erro zera, mas o integrador acumulou um valor tão gigantesco que o motor continua forçando 100% para frente.
- O carro dispara além da meta e leva um tempo enorme para frear (overshoot destrutivo).

### Como o Simulador Trata Isso? (*Anti-Windup Clamping*)
Trava condicional simples: se a força calculada atingir o limite de saturação e o erro tiver o mesmo sinal da força, **congela-se a soma da integral** para que ela não cresça desnecessariamente.

---

# MÓDULO 5: Sintonia de Controladores e o Método de Ziegler-Nichols

Sintonizar um PID é a arte de escolher os valores ideais de $K_p$, $K_i$ e $K_d$.

## 5.1 O Modelo FOPDT (*First Order Plus Dead Time*)
A maioria dos processos físicos industriais pode ser aproximada por um modelo de **Primeira Ordem com Tempo Morto**:
$$G(s) = \frac{K \cdot e^{-\theta s}}{\tau s + 1}$$

- **$K$ (Ganho Estático):** $\frac{\Delta y}{\Delta u}$ (Quanto a velocidade mudou para cada $1\text{ N}$ de força aplicada).
- **$\theta$ (Tempo Morto / Atraso Aparente):** O atraso até o sistema começar a reagir perceptivelmente.
- **$\tau$ (Constante de Tempo):** O tempo para o sistema atingir $63{,}2\%$ da sua velocidade final.

```
 Velocidade y(t)
    ▲
 y_final ┼───────────────────────────────╮ (Regime Permanente)
         │                           .·'
         │                      .·'  
         │                 .·' (Reta Tangente na maior inclinação)
       0 ┴───────────┬─────┴────────────────────────► Tempo (s)
         │◄─ theta ─►│◄────── tau ──────►│
          (Atraso)   (Constante de Tempo)
```

## 5.2 O Procedimento do Assistente de Sintonia do seu Projeto
1. **Ensaio em Malha Aberta:** O usuário clica em *"Sintonia Assistida"*. O simulador aplica um degrau constante de força ($u = 1{,}0$) sem controlador ativo.
2. **Identificação Automática:** O algoritmo rastreia o ponto de maior derivada $\left(\frac{dy}{dt}\right)_{\max}$, traça a reta tangente e extrai $K$, $\tau$ e $\theta$.
3. **Cálculo das Fórmulas de Ziegler-Nichols:**
   - Ganho Proporcional: $K_p = 1{,}2 \frac{\tau}{K \theta}$
   - Tempo Integral: $T_i = 2{,}0 \cdot \theta \implies K_i = \frac{K_p}{T_i}$
   - Tempo Derivativo: $T_d = 0{,}5 \cdot \theta \implies K_d = K_p \cdot T_d$
4. **Aplicação com 1 Clique:** O botão *"Aplicar no Editor"* escreve essas variáveis diretamente no código do aluno.

---

# MÓDULO 6: A Física das 3 Plantas no Simulador

A física é calculada através da **2ª Lei de Newton**:
$$\sum F = m \cdot a \implies a = \frac{\sum F}{m}$$

## Fase 1: Carro na Pista com Relevo
- **Equação:** $m \cdot a = u(t) - b \cdot v(t) + F_{\text{relevo}}$
- **Perturbação do Relevo:** Na subida de rampa com ângulo $\alpha$, a gravidade puxa o carro para trás:
  $$F_{\text{relevo}} = - m \cdot g \cdot \sin(\alpha)$$
- **Lição didática:** Provar que para vencer rampas íngremes sem perder velocidade, a **ação Integral ($I$)** é indispensável.

## Fase 2: Ball and Beam (Bola na Barra)
- **Equação:** $\ddot{x}(t) = \frac{5}{7} g \sin(\alpha(t)) - \frac{b_r}{m_b} \dot{x}(t) + d_{\text{pert}}$
- **Perturbação:** Impulsos repentinos ou toques na barra que desequilibram a esfera.
- **Lição didática:** Sistema **instável em malha aberta (duplo integrador $1/s^2$)**. Sem a **ação Derivativa ($D$)**, a bola oscila e cai da barra. O termo $D$ age como freio estabilizador indispensável.

## Fase 3: Tanque de Nível Industrial
- **Equação (Balanço de Massa):** $A \frac{dh(t)}{dt} = q_{\text{in}}(t) - a_{\text{out}}\sqrt{2gh(t)} - q_{\text{vaz}}(t)$
- **Perturbação:** Abertura de válvula secundária de vazamento de demanda na base.
- **Lição didática:** Planta de **1ª ordem contínua clássica da indústria de processos**. Mostra a assimetria real da bomba ($q_{\text{in}} \ge 0$, a bomba não aspira) e a eficácia da sintonia por **Ziegler-Nichols**.

### Como o Computador Calcula o Movimento? (Método de Euler a 60 FPS)
A cada $\approx 16{,}6\text{ ms}$ (`dt`):
```javascript
// 1. Aceleração instantânea
let a = (forca_motor - atrito * v + perturbacao) / massa;
// 2. Nova velocidade
v = v + a * dt;
// 3. Nova posição
x = x + v * dt;
```

---

# MÓDULO 7: A Engenharia de Computação por Trás da Aplicação

Como estudante de Engenharia de Computação da UFAL, você deve demonstrar domínio da arquitetura de software:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAMADA FRONTEND (Browser)                       │
│                                                                        │
│   CodeMirror 5          Sandbox JS                  PhysicsEngine      │
│  [Editor Código] ──▶ [new Function()] ────────▶ [Euler Explícito]      │
│                                                        │               │
│                               ┌────────────────────────┴─────────┐     │
│                               ▼                                  ▼     │
│                         Three.js 3D                         Chart.js   │
│                       [Cena WebGL/GPU]                 [Osciloscópio]  │
└───────────────────────────────────────┬────────────────────────────────┘
                                        │ HTTP REST (JSON assíncrono)
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CAMADA BACKEND (Python)                         │
│                                                                        │
│   FastAPI (REST)         ScoreService               ReportGenerator    │
│  [/api/v1/runs]  ──▶ [Diagnóstico Heurístico] ──▶ [PDF / Matplotlib]   │
│         │                                                              │
│         ▼                                                              │
│  SQLAlchemy ORM ──▶ PostgreSQL                                         │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Por que Web e não Desktop?**
   - Roda em qualquer dispositivo (Windows, Mac, Linux) sem instalar nada.
   - Democratiza o acesso em laboratórios universitários públicos com máquinas modestas.
2. **Desempenho com GPU:**
   - A renderização 3D usa **WebGL** através do **Three.js**, executada diretamente na placa de vídeo do usuário.
   - A física roda no cliente, o que significa que 100 alunos podem usar a plataforma simultaneamente sem sobrecarregar o servidor.
3. **Sandbox Segura de Execução JavaScript:**
   - O código do aluno é executado em escopo isolado via `new Function(...)`.
   - Se o aluno digitar um erro de sintaxe ou retornar `undefined`, um bloco `try/catch` intercepta o erro, pausa a simulação e mostra um alerta claro sem quebrar a aba do navegador.
4. **Backend em FastAPI + Docker:**
   - Arquitetura de microsserviços conteinerizada (`docker compose up --build`).
   - Geração de laudos científicos em PDF (ReportLab) e dados brutos em CSV para publicação acadêmica.

---

# MÓDULO 8: Simulado de Autoavaliação (Flashcards)

Teste seus conhecimentos antes da apresentação respondendo mentalmente a estas 10 perguntas:

### P1: O que é o Setpoint e o que é o Erro?
> **Resposta:** Setpoint ($r$) é a meta onde queremos chegar (ex: $600\text{ m}$). Erro ($e$) é a diferença entre a meta e onde estamos agora ($e = r - y$).

### P2: O que faz a ação Proporcional ($P$)?
> **Resposta:** Aplica uma força proporcional ao erro instantâneo ($u_P = K_p \cdot e$). Quanto maior o erro no presente, mais forte o motor empurra.

### P3: Por que o controle Proporcional puro não consegue zerar o erro se o carro estiver numa subida?
> **Resposta:** Porque para ter força, o termo $P$ precisa de erro. Conforme o carro chega perto da meta, o erro diminui e a força cai, até igualar o peso na rampa. O carro empaca e sobra um erro permanente ($e_{ss} \neq 0$).

### P4: Como a ação Integral ($I$) resolve o problema do erro de regime?
> **Resposta:** Ela soma o erro ao longo do tempo. Se o carro continuar parado antes da meta, a integral vai crescendo continuamente até o motor gerar força suficiente para vencer a rampa e colocar o carro exatamente no setpoint ($e_{ss} = 0$).

### P5: Qual é o papel da ação Derivativa ($D$)?
> **Resposta:** Funciona como um freio/amortecedor preditivo. Ela mede a velocidade com que o erro está diminuindo ($\frac{de}{dt}$) e aplica uma contra-força para conter o carro e evitar que ele passe da meta com excesso de velocidade.

### P6: O que é o Sobressinal (*Overshoot* — $M_p$)?
> **Resposta:** É o percentual que o veículo ultrapassa além da meta antes de estabilizar. Se a meta é $600\text{ m}$ e ele foi até $660\text{ m}$, o sobressinal é de $10\%$.

### P7: O que é o Integrator Windup e como você tratou isso?
> **Resposta:** É o acúmulo excessivo da integral quando o motor atinge o limite máximo de saturação (100%). Se não for travado, o carro passa muito além da meta. Tratei isso com a técnica de *clamping*, que congela a soma da integral quando o atuador satura.

### P8: Como o assistente de sintonia descobre os ganhos de Ziegler-Nichols?
> **Resposta:** Executa um teste em malha aberta com degrau de força constante ($u = 1{,}0$), mede a curva de reação (modelo FOPDT), extrai o ganho $K$, o tempo morto $\theta$ e a constante de tempo $\tau$ pelo método da reta tangente, e aplica as fórmulas clássicas de Ziegler-Nichols.

### P9: Como o simulador integra as equações físicas em tempo real?
> **Resposta:** Utiliza o método de Euler explícito a cada quadro de animação da tela (`requestAnimationFrame` a $\approx 60\text{ FPS}$). Calcula aceleração $\rightarrow$ velocidade $\rightarrow$ posição com passo $\Delta t \approx 16{,}6\text{ ms}$.

### P10: Por que a física roda no navegador (frontend) e não no servidor (backend)?
> **Resposta:** Para garantir latência zero na resposta visual a 60 FPS e escalabilidade: o servidor backend não sofre processando a física de dezenas de estudantes concorrentes; ele cuida apenas de persistência, relatórios PDF e exportação de dados.
