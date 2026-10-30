/**
 * CENA 3D — FASE 2: BOLA NA BARRA (BALL AND BEAM)
 * Sistema clássico de equilíbrio instável (duplo integrador 1/s^2).
 * A barra inclina em torno de um pivô central e uma esfera de aço rola livremente.
 */

window.SceneBallAndBeam = {
    scene: null,
    camera: null,
    renderer: null,
    
    // Objetos 3D principais
    pivotGroup: null,       // Grupo articulado da barra que gira em Z
    beamMesh: null,         // Malha do trilho/barra metálica
    ballMesh: null,         // Esfera de aço cromada
    standMesh: null,        // Pedestal/suporte triangular central
    setpointMarker: null,   // Marcador holográfico na barra
    basePlate: null,        // Placa base do chão
    angleDisplayMesh: null, // Indicador visual do ângulo
    
    // Parâmetros geométricos
    beamLength: 100,        // Comprimento da barra (-50 a +50 cm)
    ballRadius: 3.5,        // Raio da esfera
    pivotHeight: 30,        // Altura do fulcro em relação ao solo
    currentAngle: 0,        // Ângulo de inclinação atual da barra (radianos)
    lastBallPos: 0,
    
    frustumSize: 130,
    _raf: null,
    _lastTime: 0,

    init: function(containerId, setPoint) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#0c1524"); // Fundo azul espacial industrial
        this.scene.fog = new THREE.Fog("#0c1524", 250, 700);

        const aspect = container.clientWidth / container.clientHeight;
        this.frustumSize = 130;
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2,
             this.frustumSize * aspect / 2,
             this.frustumSize / 2,
            -this.frustumSize / 2,
            1, 2000
        );
        this.camera.position.set(0, 35, 280);
        this.camera.lookAt(0, 30, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Iluminação de estúdio para metais
        const ambient = new THREE.AmbientLight(0x94a3b8, 1.4);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
        keyLight.position.set(-60, 120, 90);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
        fillLight.position.set(70, 40, -40);
        this.scene.add(fillLight);

        const rimSpot = new THREE.SpotLight(0xa855f7, 2.5, 300, Math.PI / 4, 0.4);
        rimSpot.position.set(0, 110, 50);
        rimSpot.target.position.set(0, 30, 0);
        this.scene.add(rimSpot);
        this.scene.add(rimSpot.target);

        // Constrói a bancada física
        this._buildEnvironment();
        this._buildStand();
        this._buildBeamAndBall(setPoint || 0);

        this._lastTime = performance.now();
        this._renderLoop = this._renderLoop.bind(this);
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    _buildEnvironment: function() {
        // Chão técnico quadriculado
        const gridHelper = new THREE.GridHelper(260, 26, 0x334155, 0x1e293b);
        gridHelper.position.y = 0;
        this.scene.add(gridHelper);

        // Placa base metálica
        const baseGeo = new THREE.BoxGeometry(130, 2, 40);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.7,
            metalness: 0.4
        });
        this.basePlate = new THREE.Mesh(baseGeo, baseMat);
        this.basePlate.position.set(0, 1, 0);
        this.basePlate.receiveShadow = true;
        this.scene.add(this.basePlate);
    },

    _buildStand: function() {
        // Pedestal triangular central (fulcro)
        const standGroup = new THREE.Group();

        const pylonGeo = new THREE.CylinderGeometry(4, 8, this.pivotHeight, 16);
        const pylonMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.8,
            roughness: 0.3
        });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(0, this.pivotHeight / 2, 0);
        pylon.castShadow = true;
        pylon.receiveShadow = true;
        standGroup.add(pylon);

        // Rolamento / Mancal cilíndrico de articulação
        const bearingGeo = new THREE.CylinderGeometry(5, 5, 12, 24);
        bearingGeo.rotateX(Math.PI / 2);
        const bearingMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            metalness: 0.9,
            roughness: 0.2
        });
        const bearing = new THREE.Mesh(bearingGeo, bearingMat);
        bearing.position.set(0, this.pivotHeight, 0);
        bearing.castShadow = true;
        standGroup.add(bearing);

        this.scene.add(standGroup);
    },

    _buildBeamAndBall: function(setPoint) {
        // Grupo que vai rotacionar no pivô Z
        this.pivotGroup = new THREE.Group();
        this.pivotGroup.position.set(0, this.pivotHeight, 0);

        // 1. A BARRA METÁLICA (Calha em U com trilhos)
        const beamGeo = new THREE.BoxGeometry(this.beamLength, 2.5, 6);
        const beamMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            metalness: 0.85,
            roughness: 0.25
        });
        this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
        this.beamMesh.position.set(0, 0, 0);
        this.beamMesh.castShadow = true;
        this.beamMesh.receiveShadow = true;
        this.pivotGroup.add(this.beamMesh);

        // Trilhos guia laterais
        const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
        const leftRail = new THREE.Mesh(new THREE.BoxGeometry(this.beamLength, 1.2, 0.8), railMat);
        leftRail.position.set(0, 1.5, 2.5);
        this.pivotGroup.add(leftRail);

        const rightRail = new THREE.Mesh(new THREE.BoxGeometry(this.beamLength, 1.2, 0.8), railMat);
        rightRail.position.set(0, 1.5, -2.5);
        this.pivotGroup.add(rightRail);

        // Batentes inelásticos nas extremidades (-50 cm e +50 cm)
        const stopMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.4 });
        const stopLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 6.5), stopMat);
        stopLeft.position.set(-this.beamLength / 2, 2, 0);
        this.pivotGroup.add(stopLeft);

        const stopRight = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 6.5), stopMat);
        stopRight.position.set(this.beamLength / 2, 2, 0);
        this.pivotGroup.add(stopRight);

        // Linhas de escala métrica sobre a barra (marcação a cada 10 cm)
        const markMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        for (let x = -40; x <= 40; x += 10) {
            const h = (x === 0) ? 2.5 : 1.2;
            const mark = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, h), markMat);
            mark.position.set(x, 1.3, 0);
            this.pivotGroup.add(mark);
        }

        // 2. MARCADOR DE SETPOINT (Portal / anel holográfico sobre a barra)
        const markerGroup = new THREE.Group();
        const ringGeo = new THREE.TorusGeometry(5, 0.5, 12, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        markerGroup.add(ring);

        const arrowGeo = new THREE.ConeGeometry(2, 4, 16);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.rotation.x = Math.PI;
        arrow.position.y = 8;
        markerGroup.add(arrow);

        this.setpointMarker = markerGroup;
        this.setpointMarker.position.set(setPoint, 6, 0);
        this.pivotGroup.add(this.setpointMarker);

        // 3. A ESFERA DE AÇO CROMADA
        const ballGeo = new THREE.SphereGeometry(this.ballRadius, 32, 32);
        const ballMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.95,
            roughness: 0.1,
            envMapIntensity: 1.5
        });
        this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
        this.ballMesh.castShadow = true;
        // Posição Y relativa para rolar em cima da calha: metade da altura da barra (1.25) + raio (3.5)
        this.ballMesh.position.set(0, 1.25 + this.ballRadius, 0);
        this.pivotGroup.add(this.ballMesh);

        this.scene.add(this.pivotGroup);
    },

    /**
     * Atualiza a posição da esfera e o ângulo da barra em cada quadro
     * @param {number} position Posição da esfera em cm (-50 a +50)
     * @param {number} velocity Velocidade da esfera
     * @param {number} acceleration Aceleração linear
     * @param {number} dt Delta de tempo
     */
    updateTransform: function(position, velocity, acceleration, dt) {
        if (!this.ballMesh || !this.pivotGroup) return;

        // O esforço de controle do PID determina a inclinação da barra
        // No simulador, o sinal de controle u(t) comanda o ângulo em graus (limitado a +-20 graus)
        const controlForce = (window.SIM_STATE ? window.SIM_STATE.lastError : 0);
        // O ângulo de inclinação atual vem do motor físico (alpha)
        const alpha = (window.SIM_STATE && window.SIM_STATE.beamAngle !== undefined) 
            ? window.SIM_STATE.beamAngle 
            : 0;

        // Suaviza a rotação da barra com lerp
        this.currentAngle = THREE.MathUtils.lerp(this.currentAngle, alpha, 0.35);
        this.pivotGroup.rotation.z = this.currentAngle;

        // Atualiza a posição da bola ao longo da barra (clamped entre -46 e +46 cm)
        const clampedX = Math.max(-46, Math.min(46, position));
        this.ballMesh.position.x = clampedX;

        // Animação de rotação da esfera ao rolar (omega = v / R)
        const dx = clampedX - this.lastBallPos;
        this.ballMesh.rotation.z -= (dx / this.ballRadius);
        this.lastBallPos = clampedX;

        // Animação do marcador de Setpoint (pulso sutil)
        if (this.setpointMarker) {
            const scale = 1.0 + 0.08 * Math.sin(Date.now() * 0.006);
            this.setpointMarker.scale.set(scale, scale, scale);
        }
    },

    updateSetpoint: function(newSetpoint) {
        if (this.setpointMarker) {
            const clamped = Math.max(-45, Math.min(45, newSetpoint));
            this.setpointMarker.position.x = clamped;
        }
    },

    reset: function() {
        if (this.pivotGroup) this.pivotGroup.rotation.z = 0;
        if (this.ballMesh) {
            this.ballMesh.position.x = 0;
            this.ballMesh.rotation.z = 0;
        }
        this.currentAngle = 0;
        this.lastBallPos = 0;
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
        this.pivotGroup = null;
        this.beamMesh = null;
        this.ballMesh = null;
        this.setpointMarker = null;
    }
};
