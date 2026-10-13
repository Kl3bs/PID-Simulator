# Plano de Implementação: Redesenho dos Níveis 2 e 3 (Ball & Beam e Tanque de Nível)

- **Data**: 13 de outubro de 2026
- **Status**: Proposto / Em Execução
- **Especificação de Referência**: `docs/superpowers/specs/2026-10-13-ball-and-beam-water-tank-redesign.md`

---

## 🎯 Objetivos
Substituir as antigas fases do Drone (Fase 2) e Navio (Fase 3) pelas fases canônicas de controle:
1. **Fase 2: Ball and Beam (Bola na Barra)** — Dinâmica rotacional-translacional de duplo integrador ($1/s^2$) instável em malha aberta, com foco pedagógico no ganho derivativo ($K_d$).
2. **Fase 3: Tanque de Nível de Líquido (Water Tank)** — Sistema industrial de processos contínuos de 1ª ordem baseado em balanço de massa e escoamento de Torricelli, com sintonia clássica por Ziegler-Nichols.

---

## 📋 Fases de Execução

### Fase 1: Criação das Novas Cenas 3D em Three.js
- [ ] **Tarefa 1.1**: Criar `frontend/app/js/SceneBallAndBeam.js`:
  - Pedestal central articulado em torno do eixo Z;
  - Trilho / calha metálica basculante com batentes inelásticos nas extremidades ($\pm 50\text{ cm}$);
  - Esfera de aço cromada com rotação física ($\omega = v / R$);
  - Marcador holográfico e portal luminoso para o Setpoint;
  - Iluminação direcional com sombras e reflexos metálicos.
- [ ] **Tarefa 1.2**: Criar `frontend/app/js/SceneWaterTank.js`:
  - Tanque cilíndrico de vidro acrílico translúcido com graduação métrica lateral (0 a 100 cm);
  - Coluna de água adaptativa com material azul refrativo (`MeshPhysicalMaterial`) e ondulação;
  - Tubulação superior alimentadora com fluxo visível da bomba;
  - Tubulação inferior de saída com válvula e jato de dreno;
  - Linha luminosa de Setpoint na régua graduada.

### Fase 2: Integração com o Motor de Física (`PhysicsEngine.js`)
- [ ] **Tarefa 2.1**: Implementar a física da Fase 2 (Ball and Beam):
  - Aceleração: $\ddot{x} = \frac{5}{7} g \sin(\alpha) - \frac{b_r}{m_b} \dot{x} + d_{\text{pert}}$;
  - Entrada do usuário $\alpha$ (ângulo de inclinação em graus/radianos, saturado em $\pm 25^\circ$);
  - Colisão inelástica nos batentes $\pm 50\text{ cm}$.
- [ ] **Tarefa 2.2**: Implementar a física da Fase 3 (Tanque de Nível):
  - Balanço de massa: $\frac{dh}{dt} = \frac{q_{\text{in}} - a_{\text{out}}\sqrt{2gh} - q_{\text{vaz}}}{A}$;
  - Entrada do usuário $u$ (potência da bomba de 0 a 100%, sem valores negativos);
  - Saturação de nível: $h \in [0, 100\text{ cm}]$.

### Fase 3: Gerenciador de Fases, UI e Sintonia
- [ ] **Tarefa 3.1**: Atualizar `frontend/app/index.html` para incluir os scripts `SceneBallAndBeam.js` e `SceneWaterTank.js`.
- [ ] **Tarefa 3.2**: Atualizar `frontend/app/js/LevelManager.js`:
  - Metadados, labels, unidades, limites de setpoint e desafios pedagógicos das Fases 2 e 3;
  - Snippets de código padrão no editor para cada fase.
- [ ] **Tarefa 3.3**: Atualizar `frontend/app/js/TuningAssistant.js`:
  - Parâmetros nominais das novas plantas para o cálculo automático de Ziegler-Nichols e Cohen-Coon.

### Fase 4: Atualização da Documentação Acadêmica do TCC
- [ ] **Tarefa 4.1**: Atualizar `docs/tcc/capitulos/3_metodologia.tex` (modelagem analítica das duas novas plantas).
- [ ] **Tarefa 4.2**: Atualizar `docs/tcc/capitulos/4_resultados.tex` (estudos de caso de simulação das novas plantas).
- [ ] **Tarefa 4.3**: Atualizar `docs/tcc/GUIA_APRESENTACAO_TCC.md` e `docs/tcc/MANUAL_DE_ESTUDOS_TCC.md`.
- [ ] **Tarefa 4.4**: Recompilar previews HTML (`preview_tcc_completo.html` e `manual_estudos.html`).

### Fase 5: Testes Integrados e Validação
- [ ] **Tarefa 5.1**: Testar a alternância entre Fases 1, 2 e 3 no navegador.
- [ ] **Tarefa 5.2**: Testar resposta ao degrau, estabilidade a 60 FPS e assistente de sintonia.
