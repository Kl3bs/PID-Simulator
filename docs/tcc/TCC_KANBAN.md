# 📋 Kanban de Acompanhamento — TCC Engenharia de Computação (UFAL)

> **Título do Trabalho:** Desenvolvimento de uma Plataforma Web Interativa com Simulação Física 3D para Ensino, Sintonia e Análise de Desempenho de Controladores PID  
> **Autor:** Kleber Vasconcelos  
> **Orientador:** Prof. Dr. [Nome do Orientador]  
> **Instituição:** Universidade Federal de Alagoas (UFAL) — Instituto de Computação / Centro de Tecnologia  

---

## 📊 Visão Geral do Progresso

| Etapa / Capítulo | Status Geral | Concluído (%) |
| :--- | :---: | :---: |
| **Capítulo 1: Introdução** | ✅ Concluído | 100% |
| **Capítulo 2: Fundamentação Teórica e Trabalhos Correlatos** | ✅ Concluído | 100% |
| **Capítulo 3: Desenvolvimento e Arquitetura do Sistema** | ✅ Concluído | 100% |
| **Capítulo 4: Resultados Experimentais e Discussão** | ✅ Concluído | 100% |
| **Capítulo 5: Conclusão e Trabalhos Futuros** | ✅ Concluído | 100% |
| **Documento Mestre Integrado (`main.tex`)** | ✅ Concluído | 100% |

---

## 🗂️ Board Kanban por Etapas e Seções

### 🟦 Etapa 1: Capítulo 1 — Introdução
*Objetivo: Estabelecer o contexto, a dor de pesquisa, hipótese, objetivos e relevância acadêmica.*

| Seção / Atividade | Status | Descrição / Entregável |
| :--- | :---: | :--- |
| **1.1 Contextualização e Motivação** | 🔄 Em Andamento | Importância do controle PID na indústria moderna e desafios didáticos no ensino de engenharia. |
| **1.2 Problema de Pesquisa** | 🔄 Em Andamento | Dificuldades associadas a licenças de alto custo (MATLAB) e limitações de simuladores 2D estáticos. |
| **1.3 Hipótese de Pesquisa** | 🔄 Em Andamento | Benefício pedagógico da visualização física 3D em tempo real acoplada à decomposição $u_P, u_I, u_D$. |
| **1.4 Objetivos (Geral e Específicos)** | ✅ Concluído | Verbos no infinitivo alinhados às diretrizes de Engenharia de Computação da UFAL. |
| **1.5 Justificativa e Relevância** | 🔄 Em Andamento | Relevância acadêmica, técnica, pedagógica e econômica para laboratórios da UFAL. |
| **1.6 Organização do Trabalho** | 📌 A Fazer | Resumo estrutural de cada capítulo subsequente da monografia. |

---

### 🟨 Etapa 2: Capítulo 2 — Fundamentação Teórica e Trabalhos Correlatos
*Objetivo: Embasar matematicamente o controle clássico e contextualizar o estado da arte de laboratórios virtuais.*

| Seção / Atividade | Status | Descrição / Entregável |
| :--- | :---: | :--- |
| **2.1.1 Ações do Controlador PID** | 📌 A Fazer | Equacionamento contínuo e discreto das parcelas proporcional, integral e derivativa. |
| **2.1.2 Métricas de Desempenho** | 📌 A Fazer | Definições formais de $t_r, t_s, M_p, e_{ss}$ e índice de erro quadrático $\text{RMSE}$. |
| **2.1.3 Não-Linearidades Práticas** | 📌 A Fazer | Saturação de atuadores, efeito *integrator windup* e estratégias de compensação. |
| **2.2.1 Modelo FOPDT** | 📌 A Fazer | Dinâmica de primeira ordem com atraso de transporte ($K, \tau, \theta$) e método da curva de reação. |
| **2.2.2 Critérios de Ziegler-Nichols** | 📌 A Fazer | Tabelas e formulações analíticas para sintonia em malha aberta. |
| **2.3 Ambientes Virtuais de Ensino** | 📌 A Fazer | Revisão do papel dos laboratórios virtuais na educação em engenharia. |
| **2.4 Tecnologias Computacionais** | 📌 A Fazer | WebGL, Three.js, sandboxing em navegadores e arquitetura REST assíncrona (FastAPI). |
| **2.5 Trabalhos Relacionados** | 📌 A Fazer | Tabela comparativa confrontando o PID Simulator com outras ferramentas acadêmicas. |

---

### 🟧 Etapa 3: Capítulo 3 — Desenvolvimento e Arquitetura do Sistema
*Objetivo: Detalhar o projeto de engenharia de software, modelagem física e implementação fullstack.*

| Seção / Atividade | Status | Descrição / Entregável |
| :--- | :---: | :--- |
| **3.1 Requisitos e Arquitetura** | 📌 A Fazer | Requisitos funcionais/não funcionais e diagrama de blocos em camadas da solução. |
| **3.2.1 Formulação Dinâmica das Plantas**| 📌 A Fazer | Equações diferenciais de movimento para veículo, drone e navio. |
| **3.2.2 Perturbações e Relevo 3D** | 📌 A Fazer | Modelagem do relevo tridimensional $\alpha(x)$ e força gravitacional $F_{\text{relevo}} = -mg\sin(\alpha)$. |
| **3.2.3 Discretização Numérica** | 📌 A Fazer | Integração numérica por Euler explícito no laço de simulação a 60 FPS (`requestAnimationFrame`). |
| **3.3.1 Editor e Sandbox JavaScript** | 📌 A Fazer | Isolamento do escopo de execução do código do usuário sem acesso à DOM global. |
| **3.3.2 Bancada Tridimensional (Three.js)**| 📌 A Fazer | Construção do circuito modular, iluminação dinâmica e câmera com suavização (*lerp*). |
| **3.3.3 Osciloscópio Digital Multicanal** | 📌 A Fazer | Renderização síncrona das curvas $y(t), r(t), u_P, u_I, u_D$ com limites de saturação. |
| **3.3.4 Assistente de Sintonia Automático**| 📌 A Fazer | Implementação algorítmica da reta tangente e injeção direta de ganhos no editor. |
| **3.4 API Backend e Relatórios** | 📌 A Fazer | Endpoints FastAPI, persistência relacional e gerador de relatórios técnicos em PDF/CSV. |
| **3.5 Conteinerização (Docker)** | 📌 A Fazer | Configuração dos contêineres e reprodutibilidade do ambiente experimental. |

---

### 🟩 Etapa 4: Capítulo 4 — Resultados Experimentais e Discussão
*Objetivo: Comprovar a acurácia matemática, estabilidade computacional e valor didático da plataforma.*

| Seção / Atividade | Status | Descrição / Entregável |
| :--- | :---: | :--- |
| **4.1 Validação do Modelo Físico** | 📌 A Fazer | Comparação das curvas do simulador com soluções analíticas calculadas via SciPy. |
| **4.2 Avaliação da Decomposição $P, I, D$**| 📌 A Fazer | Análise gráfica do impacto de cada componente e visualização da ação anti-windup. |
| **4.3 Ensaios de Sintonia Assistida** | 📌 A Fazer | Resultados práticos do método de Ziegler-Nichols aplicado à pista com perturbações. |
| **4.4 Resposta sob Relevo Dinâmico** | 📌 A Fazer | Comportamento transitório do veículo ao cruzar aclives e declives acentuados. |
| **4.5 Desempenho Computacional** | 📌 A Fazer | Métricas de FPS, tempo de amostragem $\Delta t$, consumo de memória e latência de rede. |

---

### 🟪 Etapa 5: Capítulo 5 — Conclusão e Trabalhos Futuros
*Objetivo: Sintetizar as metas alcançadas, contribuições para a UFAL e horizontes de expansão científica.*

| Seção / Atividade | Status | Descrição / Entregável |
| :--- | :---: | :--- |
| **5.1 Considerações Finais** | 📌 A Fazer | Síntese do cumprimento dos objetivos propostos no Capítulo 1. |
| **5.2 Principais Contribuições** | 📌 A Fazer | Impacto pedagógico para cursos de engenharia e avanço em laboratórios virtuais leves. |
| **5.3 Limitações Identificadas** | 📌 A Fazer | Restrições de modelos de atrito simplificados e ausência de hardware físico real. |
| **5.4 Trabalhos Futuros** | 📌 A Fazer | Sintonia por Algoritmos Genéticos/IA, integração *Hardware-in-the-Loop* e novos cenários. |

---

## 🏷️ Legenda de Status
- 📌 **A Fazer:** Seção planejada, aguardando início da redação/execução.
- 🔄 **Em Andamento:** Seção em fase de pesquisa, estruturação ou escrita ativa.
- 🔍 **Em Revisão:** Texto finalizado submetido a revisão ortográfica, ABNT ou parecer do orientador.
- ✅ **Concluído:** Conteúdo aprovado e integrado à monografia.
