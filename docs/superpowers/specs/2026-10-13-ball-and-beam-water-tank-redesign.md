# Documento de Especificação Técnica: Redesenho dos Níveis 2 e 3 (Ball and Beam & Tanque de Nível)

- **Data**: 13 de outubro de 2026
- **Status**: Em Revisão / Proposto
- **Autor**: Kleber Vasconcelos & Antigravity Agent
- **Contexto**: Trabalho de Conclusão de Curso (TCC) em Engenharia de Computação — UFAL
- **Documento Relacionado**: `docs/superpowers/specs/2026-09-16-pid-simulator-tcc-enrichment-design.md`

---

## 1. Visão Geral e Justificativa Acadêmica

O projeto **PID Simulator** originalmente contemplava três fases:
1. *Fase 1*: Carro na Pista (controle linear de posição com atrito e relevo);
2. *Fase 2*: Drone no Vento (controle vertical sob rajadas estocásticas);
3. *Fase 3*: Navio no Porto (controle de posição sob correntes marinhas e alta inércia).

Embora o Drone e o Navio possuam apelo visual, ambos compartilham equações de movimento muito semelhantes à do Carro (mecânica newtoniana de 2ª ordem com forças adicionadas). Para enriquecer substancialmente o valor didático do TCC perante a banca examinadora da UFAL, substitui-se o Drone e o Navio por dois dos maiores referenciais canônicos da engenharia de controle:

1. **Nova Fase 2 — Ball and Beam (Bola na Barra)**:
   - **Natureza**: Sistema mecânico rotacional-translacional subatuado e **intrinsecamente instável em malha aberta** (duplo integrador $1/s^2$).
   - **Mérito Pedagógico**: Prova categoricamente que um controle puramente proporcional ($P$) ou integral ($PI$) é incapaz de estabilizar a planta sem cair da barra, tornando a **ação derivativa ($D$) estritamente indispensável** para amortecer o movimento da esfera.
   
2. **Nova Fase 3 — Tanque de Nível de Líquido (Water Tank)**:
   - **Natureza**: Sistema de controle de processos contínuos e dinâmica de fluidos (**1ª ordem não mecânica**).
   - **Mérito Pedagógico**: Demonstra um processo industrial típico regulado por conservação de massa volumétrica, perfeitamente aderente ao método de identificação FOPDT e sintonia clássica de **Ziegler-Nichols**, além de expor a assimetria real de atuadores (bombas empurram água, mas não aspiram).

Com essa reformulação, o TCC passa a abranger a tríade canônica completa:
- **Fase 1 (Carro)**: Mecânica linear estável com rejeição a perturbação de rampa gravitacional;
- **Fase 2 (Ball and Beam)**: Mecânica de equilíbrio instável exigindo amortecimento preditivo;
- **Fase 3 (Tanque)**: Engenharia de processos industriais contínuos com sintonia clássica assistida.

---

## 2. Modelagem Matemática e Equacionamento Físico

### 2.1 Fase 2: Ball and Beam (Bola e Barra)

Uma esfera de massa $m_b$, raio $R$ e momento de inércia esférico $J_b = \frac{2}{5} m_b R^2$ rola sem deslizar sobre uma barra rígida de comprimento $L$ articulada em seu centro ($x = 0$).

#### Equação Dinâmica
A aceleração da bola ao longo da barra em função do ângulo de inclinação $\alpha(t)$ é expressa por:

\begin{equation}
\left( \frac{J_b}{R^2} + m_b \right) \ddot{x}(t) = m_b g \sin(\alpha(t)) - m_b x(t) \dot{\alpha}(t)^2 - b_r \dot{x}(t)
\end{equation}

Para pequenos ângulos de inclinação ($\sin(\alpha) \approx \alpha$) e velocidade angular da barra moderada ($\dot{\alpha}^2 \approx 0$):

\begin{equation}
\ddot{x}(t) = \frac{5}{7} g \alpha(t) - \frac{b_r}{m_b} \dot{x}(t)
\end{equation}

\noindent onde:
- $x(t) \in [-L/2, +L/2]$ representa a posição da bola (em metros ou centímetros);
- $\alpha(t) \in [-\alpha_{\max}, +\alpha_{\max}]$ é o ângulo de inclinação comandado pelo controlador (em radianos ou normalizado em porcentagem do servo);
- $g = 9{,}81\text{ m/s}^2$ (aceleração gravitacional);
- $b_r$ é o coeficiente de atrito de rolamento da esfera.

#### Função de Transferência
No domínio de Laplace sob linearização:

\begin{equation}
G_{\text{bb}}(s) = \frac{X(s)}{\alpha(s)} = \frac{\frac{5}{7} g}{s \left( s + \frac{b_r}{m_b} \right)} \approx \frac{K_{\text{bb}}}{s^2}
\end{equation}

A presença de dois polos na origem ($1/s^2$) configura a clássica instabilidade com margem de fase nula sem ação derivativa ($K_d$).

---

### 2.2 Fase 3: Tanque de Nível de Líquido (Water Tank)

Um reservatório cilíndrico de área transversal uniforme $A$ recebe uma vazão volumétrica de entrada $q_{\text{in}}(t)$ provida por uma bomba centrífuga e descarrega água por um orifício na base com área $a_{\text{out}}$.

#### Equação de Balanço de Massa
A variação temporal do volume de líquido dentro do tanque é dada pela conservação de massa:

\begin{equation}
A \frac{dh(t)}{dt} = q_{\text{in}}(t) - q_{\text{out}}(t) - q_{\text{pert}}(t)
\end{equation}

Pela Lei de Torricelli, a vazão de escoamento livre no dreno é não-linear em relação à coluna de líquido $h(t)$:

\begin{equation}
q_{\text{out}}(t) = a_{\text{out}} \sqrt{2 g h(t)}
\end{equation}

\noindent Linearizando em torno de um ponto de operação de altura nominal $h_0$:

\begin{equation}
q_{\text{out}}(t) \approx \frac{h(t)}{R_h}, \quad \text{onde } R_h = \frac{\sqrt{2 g h_0}}{g a_{\text{out}}} \text{ (Resistência Hidráulica)}
\end{equation}

Portanto, a equação linearizada de primeira ordem resulta em:

\begin{equation}
A R_h \frac{dh(t)}{dt} + h(t) = R_h \, q_{\text{in}}(t) \implies \tau_h \frac{dh(t)}{dt} + h(t) = K_h \, u(t)
\end{equation}

\noindent onde:
- $\tau_h = A R_h$ é a constante de tempo do tanque;
- $K_h = R_h$ é o ganho estático;
- $q_{\text{pert}}(t)$ modela uma torneira de consumo ou vazamento adicional na base (perturbação externa).

---

## 3. Arquitetura e Implementação no Frontend

### 3.1 Substituição dos Módulos Three.js

1. **`frontend/app/js/SceneBallAndBeam.js`** (Substitui `SceneDrone.js`):
   - **Estrutura 3D**:
     - Suporte / pedestal central metálico fixo no solo;
     - Barra articulada com trilhos laterais que gira em torno do eixo $Z$ (`pivot.rotation.z = alpha`);
     - Esfera cromada com reflexos metálicos (`MeshStandardMaterial` com `roughness = 0.1` e `metalness = 0.9`);
     - Rotação angular síncrona da esfera ao rolar ($\omega_y = v / R$);
     - Portal holográfico luminoso posicionado na coordenada do Setpoint sobre a barra;
     - Delimitadores nas extremidades da barra com colisão inelástica (a bola atinge os batentes em $\pm L/2$ sem atravessar o espaço).

2. **`frontend/app/js/SceneWaterTank.js`** (Substitui `SceneShip.js`):
   - **Estrutura 3D**:
     - Cilindro de vidro acrílico translúcido com régua graduada de 0 a 100 cm gravada na lateral;
     - Coluna de água interna com geometria adaptativa em tempo real (`cylinder.scale.y = h / h_max`);
     - Material de água translúcido azul com refração (`MeshPhysicalMaterial`, `transmission = 0.8`, `opacity = 0.85`);
     - Tubulação superior alimentadora com efeito visual de jato de água proporcional a $q_{\text{in}}$;
     - Tubulação inferior de dreno com válvula visível e fluxo de saída;
     - Marcador visual de nível desejado (Setpoint em linha vermelha luminosa sobre a régua).

### 3.2 Modificações no `PhysicsEngine.js`

O laço de simulação em tempo real (`loop`) será atualizado:
- **Fase 2 (Ball and Beam)**:
  - Entrada do algoritmo do usuário: retorna o ângulo da barra $\alpha \in [-25^\circ, +25^\circ]$ ou força de inclinação;
  - Cálculo de aceleração: $a_x = \frac{5}{7} g \sin(\alpha) - (b_r / m_b) v_x + d_{\text{pert}}$;
  - Integração por Euler: $v_x[k] = v_x[k-1] + a_x \Delta t$, $x[k] = x[k-1] + v_x \Delta t$;
  - Saturação espacial: se $|x| \ge L/2$, a bola atinge o batente e $v_x$ é amortecida com coeficiente de restituição.
- **Fase 3 (Tanque de Nível)**:
  - Entrada do algoritmo do usuário: potência da bomba $u \in [0, 100\%]$ (não admite valores negativos — a bomba não aspira);
  - Vazão de saída calculada: $q_{\text{out}} = a_{\text{out}} \sqrt{2 g \max(0, h)}$;
  - Balanço de massa: $\frac{dh}{dt} = \frac{u \cdot q_{\max} - q_{\text{out}} - q_{\text{vazamento}}}{A}$;
  - Integração por Euler: $h[k] = \max(0, \min(H_{\max}, h[k-1] + \frac{dh}{dt} \Delta t))$.

### 3.3 Modificações no `LevelManager.js`

Atualização das definições de fases:

| Propriedade | Fase 1 (Mantida) | Nova Fase 2 (Ball & Beam) | Nova Fase 3 (Tanque de Nível) |
| :--- | :--- | :--- | :--- |
| **Nome** | Carro na Pista | Bola na Barra (Ball & Beam) | Tanque de Nível Industrial |
| **Subtítulo** | Controle de Posição Linear | Equilíbrio Instável (Duplo Integrador) | Controle de Nível e Fluidos |
| **Dificuldade** | INICIANTE | AVANÇADO | ESPECIALISTA |
| **Variável de Processo ($y$)** | Posição $x$ (m) | Posição da Esfera $x$ (cm) | Altura da Água $h$ (cm) |
| **Unidades** | m, m/s, m, N | cm, cm/s, cm, ° | cm, cm/s, cm, % |
| **Meta Padrão** | 600 m (faixa 100-900) | 0 cm (faixa -40 a +40 cm) | 60 cm (faixa 10 a 90 cm) |
| **Código Padrão** | PID linear padrão | PD com amortecimento derivativo | PI clássico de processos |
| **Desafio** | Sem overshoot ($M_p < 5\%$) | Manter estável no centro ($\pm 2\text{ cm}$) | Rejeitar vazamento repentino |

### 3.4 Modificações no `TuningAssistant.js`

Atualização do método `getPlantParameters`:
- **Fase 2 (Ball & Beam)**:
  - Modelo de duplo integrador equivalente com atraso de servo: $K \approx 1{,}2$, $\tau \approx 2{,}5\text{ s}$, $\theta \approx 0{,}25\text{ s}$.
- **Fase 3 (Tanque)**:
  - Modelo FOPDT clássico de primeira ordem: $K \approx 0{,}8\text{ cm/\%}$, $\tau \approx 12{,}0\text{ s}$, $\theta \approx 0{,}5\text{ s}$.
  - Ganhos calculados automaticamente por Ziegler-Nichols (PI e PID) e Cohen-Coon perfeitamente estáveis para o tanque.

---

## 4. Atualização na Documentação Acadêmica (TCC)

Após a aprovação desta especificação e implementação do código, a monografia em LaTeX será ajustada nos pontos correspondentes:

1. **`3_metodologia.tex`**:
   - Seção 3.2.2: Redação da modelagem analítica da Bola na Barra (equação da inércia esférica $\frac{5}{7}g\alpha$ e estabilidade);
   - Seção 3.2.3: Redação da modelagem do Tanque de Nível (balanço de massa volumétrico e Lei de Torricelli).
2. **`4_resultados.tex`**:
   - Seção 4.3: Resultados experimentais do Ball and Beam comprovando a necessidade imperativa do ganho derivativo $K_d$;
   - Seção 4.4: Resultados do Tanque de Nível demonstrando a rejeição a perturbações de vazamento e a sintonia por Ziegler-Nichols.
3. **`GUIA_APRESENTACAO_TCC.md` & `MANUAL_DE_ESTUDOS_TCC.md`**:
   - Atualização das tabelas de fases e dos roteiros de apresentação para refletir o Ball & Beam e o Tanque de Nível.

---

## 5. Plano de Validação e Verificação

1. **Verificação Numérica da Bola na Barra**:
   - Garantir que um controlador Proporcional puro ($K_i = 0, K_d = 0$) oscile continuamente e atinja os batentes (comportamento fisicamente esperado);
   - Garantir que a adição de $K_d$ amorteça a velocidade da esfera e a mantenha estável no Setpoint.
2. **Verificação Numérica do Tanque de Nível**:
   - Garantir que a bomba não admita fluxo negativo ($q_{\text{in}} \ge 0$);
   - Garantir que, ao desligar a bomba ($u = 0$), o tanque esvazie gradualmente pela gravidade até atingir $h = 0$;
   - Garantir que o ensaio de curva de reação em malha aberta produza a clássica curva de subida exponencial de primeira ordem.
3. **Desempenho Gráfico**:
   - Garantir taxa de quadros sustentada ($\ge 50\text{ FPS}$) nas duas novas cenas 3D em Three.js.
