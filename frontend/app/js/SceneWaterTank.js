/**
 * CENA 3D — FASE 3: TANQUE DE NÍVEL DE LÍQUIDO (WATER TANK)
 * Processo industrial contínuo de 1ª ordem baseado no balanço volumétrico de massa.
 * Apresenta coluna de água com refração, tubo de entrada com fluxo da bomba,
 * dreno inferior e marcador holográfico de altura de setpoint.
 */

window.SceneWaterTank = {
    scene: null,
    camera: null,
    renderer: null,

    // Objetos 3D
    tankGlass: null,        // Cilindro externo de vidro/acrílico transparente
    waterMesh: null,        // Coluna de água azul translúcida
    waterSurface: null,     // Disco da superfície da água
    inletPipe: null,        // Tubo de entrada superior da bomba
    inletStream: null,      // Jato/fluxo de água animado caindo no tanque
    drainPipe: null,        // Tubo de dreno na base
    drainStream: null,      // Jato de água saindo pelo dreno
    setpointRing: null,     // Linha/anel luminoso de referência de altura
    rulerGroup: null,       // Régua métrica graduada de 0 a 100 cm
    
    // Dimensões do tanque
    tankHeight: 100,        // Altura total útil (100 cm)
    tankRadius: 22,         // Raio do cilindro
    waterHeight: 0,         // Altura atual da água (0 a 100 cm)
    currentFlowIn: 0,       // Fluxo de entrada da bomba
    
    frustumSize: 150,
    _raf: null,
    _lastTime: 0,

    init: function(containerId, setPoint) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#09131f"); // Fundo azul marinho escuro
        this.scene.fog = new THREE.Fog("#09131f", 250, 750);

        const aspect = container.clientWidth / container.clientHeight;
        this.frustumSize = 145;
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2,
             this.frustumSize * aspect / 2,
             this.frustumSize / 2,
            -this.frustumSize / 2,
            1, 2000
        );
        this.camera.position.set(0, 55, 300);
        this.camera.lookAt(0, 50, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Iluminação de estúdio para líquidos e vidro
        const ambient = new THREE.AmbientLight(0x94a3b8, 1.6);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(-60, 140, 80);
        keyLight.castShadow = true;
        this.scene.add(keyLight);

        const waterGlow = new THREE.PointLight(0x00f2fe, 1.8, 150);
        waterGlow.position.set(0, 50, 20);
        this.scene.add(waterGlow);

        this._buildEnvironment();
        this._buildTank(setPoint || 60);

        this._lastTime = performance.now();
        this._renderLoop = this._renderLoop.bind(this);
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    _buildEnvironment: function() {
        // Base industrial de concreto e aço
        const floorGrid = new THREE.GridHelper(260, 26, 0x1e293b, 0x0f172a);
        floorGrid.position.y = 0;
        this.scene.add(floorGrid);

        // Suporte metálico na base do tanque
        const pedestalGeo = new THREE.CylinderGeometry(this.tankRadius + 5, this.tankRadius + 8, 6, 32);
        const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.set(0, 3, 0);
        pedestal.receiveShadow = true;
        this.scene.add(pedestal);
    },

    _buildTank: function(setPoint) {
        const tankGroup = new THREE.Group();
        tankGroup.position.set(0, 6, 0); // Repousa sobre o pedestal

        // 1. CILINDRO DE VIDRO TRANSPARENTE
        const glassGeo = new THREE.CylinderGeometry(this.tankRadius, this.tankRadius, this.tankHeight, 36, 1, true);
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x93c5fd,
            transparent: true,
            opacity: 0.25,
            roughness: 0.05,
            metalness: 0.1,
            transmission: 0.7,
            side: THREE.DoubleSide
        });
        this.tankGlass = new THREE.Mesh(glassGeo, glassMat);
        this.tankGlass.position.y = this.tankHeight / 2;
        tankGroup.add(this.tankGlass);

        // Anéis metálicos de reforço no topo e na base do vidro
        const ringGeo = new THREE.TorusGeometry(this.tankRadius + 0.5, 0.8, 12, 36);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
        
        const topRing = new THREE.Mesh(ringGeo, ringMat);
        topRing.position.y = this.tankHeight;
        tankGroup.add(topRing);

        const botRing = new THREE.Mesh(ringGeo, ringMat);
        botRing.position.y = 0;
        tankGroup.add(botRing);

        // 2. COLUNA DE ÁGUA TRANSLÚCIDA
        // Geometria padrão com altura 1, que será escalada dinamicamente via scale.y
        const waterGeo = new THREE.CylinderGeometry(this.tankRadius - 0.4, this.tankRadius - 0.4, 1, 32);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            transparent: true,
            opacity: 0.82,
            roughness: 0.1,
            metalness: 0.2
        });
        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.position.y = 0.5; // Centro da água quando scale.y = 1
        this.waterMesh.scale.set(1, 0.01, 1);
        tankGroup.add(this.waterMesh);

        // Disco para superfície da água com leve brilho
        const surfaceGeo = new THREE.CircleGeometry(this.tankRadius - 0.4, 32);
        surfaceGeo.rotateX(-Math.PI / 2);
        const surfaceMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
        this.waterSurface = new THREE.Mesh(surfaceGeo, surfaceMat);
        this.waterSurface.position.y = 1;
        tankGroup.add(this.waterSurface);

        // 3. RÉGUA GRADUADA LATERAL (0 a 100 cm)
        this.rulerGroup = new THREE.Group();
        this.rulerGroup.position.set(this.tankRadius + 3, 0, 0);

        const rulerRodGeo = new THREE.BoxGeometry(0.8, this.tankHeight, 0.8);
        const rulerRodMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const rulerRod = new THREE.Mesh(rulerRodGeo, rulerRodMat);
        rulerRod.position.y = this.tankHeight / 2;
        this.rulerGroup.add(rulerRod);

        const markMajorMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
        const markMinorMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
        for (let h = 0; h <= 100; h += 10) {
            const isMajor = (h % 20 === 0);
            const w = isMajor ? 3.5 : 1.8;
            const mark = new THREE.Mesh(
                new THREE.BoxGeometry(w, 0.5, 0.4),
                isMajor ? markMajorMat : markMinorMat
            );
            mark.position.set(-w / 2, h, 0);
            this.rulerGroup.add(mark);
        }
        tankGroup.add(this.rulerGroup);

        // 4. MARCADOR DE SETPOINT (Laser / anel luminoso em vermelho-coral)
        const spRingGeo = new THREE.TorusGeometry(this.tankRadius + 1.2, 0.6, 8, 36);
        spRingGeo.rotateX(Math.PI / 2);
        const spRingMat = new THREE.MeshBasicMaterial({ color: 0xff5252 });
        this.setpointRing = new THREE.Mesh(spRingGeo, spRingMat);
        this.setpointRing.position.y = setPoint;
        tankGroup.add(this.setpointRing);

        // 5. TUBULAÇÃO SUPERIOR (Entrada da Bomba)
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
        const inPipeGeo = new THREE.CylinderGeometry(2.5, 2.5, 30, 16);
        inPipeGeo.rotateZ(Math.PI / 2);
        this.inletPipe = new THREE.Mesh(inPipeGeo, pipeMat);
        this.inletPipe.position.set(-this.tankRadius - 5, this.tankHeight + 6, 0);
        tankGroup.add(this.inletPipe);

        // Bocal de entrada
        const inNozzleGeo = new THREE.CylinderGeometry(2.5, 2.5, 8, 16);
        const inNozzle = new THREE.Mesh(inNozzleGeo, pipeMat);
        inNozzle.position.set(-this.tankRadius + 10, this.tankHeight + 2, 0);
        tankGroup.add(inNozzle);

        // Jato de fluxo de entrada da bomba (Cilindro animado)
        const streamGeo = new THREE.CylinderGeometry(1.4, 1.8, this.tankHeight, 12);
        const streamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });
        this.inletStream = new THREE.Mesh(streamGeo, streamMat);
        this.inletStream.position.set(-this.tankRadius + 10, this.tankHeight / 2, 0);
        this.inletStream.visible = false;
        tankGroup.add(this.inletStream);

        // 6. TUBULAÇÃO INFERIOR DE DRENO
        const outPipeGeo = new THREE.CylinderGeometry(2, 2, 20, 16);
        outPipeGeo.rotateZ(Math.PI / 2);
        this.drainPipe = new THREE.Mesh(outPipeGeo, pipeMat);
        this.drainPipe.position.set(this.tankRadius + 10, 4, 0);
        tankGroup.add(this.drainPipe);

        // Jato de saída do dreno
        const drainStreamGeo = new THREE.CylinderGeometry(1.2, 1.0, 16, 12);
        drainStreamGeo.rotateZ(Math.PI / 2);
        const drainStreamMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75 });
        this.drainStream = new THREE.Mesh(drainStreamGeo, drainStreamMat);
        this.drainStream.position.set(this.tankRadius + 18, 4, 0);
        tankGroup.add(this.drainStream);

        this.scene.add(tankGroup);
    },

    /**
     * Atualiza o nível da água e a visualização dos fluxos
     * @param {number} level Altura atual da água em cm (0 a 100)
     * @param {number} rate Taxa de variação dh/dt
     * @param {number} pumpControl Sinal da bomba (0 a 100%)
     * @param {number} dt Delta de tempo
     */
    updateTransform: function(level, rate, pumpControl, dt) {
        if (!this.waterMesh || !this.waterSurface) return;

        const clampedLevel = Math.max(0.1, Math.min(100, level));
        this.waterHeight = clampedLevel;

        // Escala vertical da coluna de água
        this.waterMesh.scale.y = clampedLevel;
        this.waterMesh.position.y = clampedLevel / 2;

        // Superfície acompanha o topo da coluna de água com ondulação suave
        const ripple = 0.2 * Math.sin(Date.now() * 0.008);
        this.waterSurface.position.y = clampedLevel + ripple;

        // Animação do fluxo de entrada da bomba
        const pumpPower = (window.SIM_STATE && window.SIM_STATE.pumpPower !== undefined) 
            ? window.SIM_STATE.pumpPower 
            : 0;

        if (pumpPower > 2) {
            this.inletStream.visible = true;
            const jetLength = Math.max(2, this.tankHeight - clampedLevel);
            this.inletStream.scale.set(pumpPower / 100, jetLength / this.tankHeight, pumpPower / 100);
            this.inletStream.position.y = clampedLevel + (jetLength / 2);
            this.inletStream.material.opacity = Math.min(0.9, 0.4 + (pumpPower / 150));
        } else {
            this.inletStream.visible = false;
        }

        // Animação do fluxo de saída do dreno (proporcional a sqrt(h))
        if (clampedLevel > 1) {
            this.drainStream.visible = true;
            const flowOut = Math.sqrt(clampedLevel / 100);
            this.drainStream.scale.set(flowOut, 1, flowOut);
        } else {
            this.drainStream.visible = false;
        }

        // Pulso sutil no anel de Setpoint
        if (this.setpointRing) {
            const pulse = 1.0 + 0.04 * Math.sin(Date.now() * 0.005);
            this.setpointRing.scale.set(pulse, 1, pulse);
        }
    },

    updateSetpoint: function(newSetpoint) {
        if (this.setpointRing) {
            const clamped = Math.max(5, Math.min(95, newSetpoint));
            this.setpointRing.position.y = clamped;
        }
    },

    reset: function() {
        this.waterHeight = 0;
        if (this.waterMesh) {
            this.waterMesh.scale.y = 0.01;
            this.waterMesh.position.y = 0.05;
        }
        if (this.waterSurface) this.waterSurface.position.y = 0.1;
        if (this.inletStream) this.inletStream.visible = false;
        if (this.drainStream) this.drainStream.visible = false;
        this._renderScene();
    },

    _renderLoop: function(ts) {
        if (!this.renderer) return;
        this._renderScene();
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    _renderScene: function() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    destroy: function() {
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        this.scene = null;
        this.renderer = null;
        this.tankGlass = null;
        this.waterMesh = null;
        this.waterSurface = null;
        this.inletStream = null;
        this.drainStream = null;
        this.setpointRing = null;
        this.rulerGroup = null;
    }
};
