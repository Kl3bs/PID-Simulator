/**
 * MÓDULO DE RENDERIZAÇÃO 3D (FASE 1 - CIRCUITO COM RELEVO DINÂMICO)
 * Suporta pista tridimensional com elevações (Aclive, Declive, Ondulações)
 * e cálculo de normais/tangentes para orientação do veículo.
 */
window.Scene3D = {
    scene: null,
    camera: null,
    renderer: null,
    carModels: {},
    trackGroup: null,
    trackMesh: null,
    curbsMesh: null,
    dashesMesh: null,
    finishPortal: null,
    _raf: null,
    
    frustumSize: 450,
    currentTerrainMode: 'flat', // 'flat', 'incline', 'decline', 'wave'
    trackLength: 3200,
    trackWidth: 160,
    segmentCount: 160,

    init: function(containerId, setPoint = 600) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        window.ActiveScene = this;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#0B0F19"); // Estética ardósia escura de laboratório
        this.scene.fog = new THREE.FogExp2(0x0B0F19, 0.0004);

        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2, this.frustumSize * aspect / 2,
            this.frustumSize / 2, -this.frustumSize / 2,
            1, 4000
        );
        this.camera.position.set(300, 550, 700);
        this.camera.lookAt(300, 50, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.buildLighting();
        this.buildScenery();
        this.buildCar();

        this.updateTargetLine = this.updateTargetLine.bind(this);
        this.updateTransform = this.updateTransform.bind(this);
        this.setTerrainMode = this.setTerrainMode.bind(this);
        this.reset = this.reset.bind(this);
        
        this._renderLoop = this._renderLoop.bind(this);
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    buildLighting: function() {
        const ambient = new THREE.AmbientLight(0xddeeff, 0.65);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(400, 1000, 600);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -1500;
        dirLight.shadow.camera.right = 1500;
        dirLight.shadow.camera.top = 800;
        dirLight.shadow.camera.bottom = -800;
        dirLight.shadow.camera.far = 3000;
        this.scene.add(dirLight);

        // Luz de preenchimento azul ciano para estética técnica
        const fillLight = new THREE.DirectionalLight(0x00F2FE, 0.35);
        fillLight.position.set(-300, 300, -400);
        this.scene.add(fillLight);
    },

    /**
     * Função matemática do perfil de relevo h(x)
     */
    getElevationAndSlope: function(x) {
        let y = 0;
        let slope = 0; // dy/dx

        switch (this.currentTerrainMode) {
            case 'incline': // Aclive (+15° ~ 0.26 rad)
                if (x >= 150 && x <= 650) {
                    const progress = (x - 150) / 500;
                    // Curva suave em S (smoothstep)
                    const s = progress * progress * (3 - 2 * progress);
                    const ds = (6 * progress - 6 * progress * progress) / 500;
                    const maxH = 135;
                    y = s * maxH;
                    slope = ds * maxH;
                } else if (x > 650) {
                    y = 135;
                    slope = 0;
                }
                break;

            case 'decline': // Declive (-15°)
                if (x >= 150 && x <= 650) {
                    const progress = (x - 150) / 500;
                    const s = progress * progress * (3 - 2 * progress);
                    const ds = (6 * progress - 6 * progress * progress) / 500;
                    const minH = -110;
                    y = s * minH;
                    slope = ds * minH;
                } else if (x > 650) {
                    y = -110;
                    slope = 0;
                }
                break;

            case 'wave': // Relevo ondulado senoidal
                if (x >= 100) {
                    const freq = 0.012;
                    const amp = 40;
                    y = Math.sin((x - 100) * freq) * amp;
                    slope = Math.cos((x - 100) * freq) * freq * amp;
                }
                break;

            case 'flat':
            default:
                y = 0;
                slope = 0;
                break;
        }

        const angle = Math.atan(slope);
        return { y, slope, angle };
    },

    setTerrainMode: function(mode) {
        this.currentTerrainMode = mode;
        this.rebuildTrackGeometry();
        if (window.SIM_STATE) {
            window.SIM_STATE.terrainMode = mode;
        }
        this.updateTargetLine(window.SIM_STATE ? window.SIM_STATE.setPoint : 600);
    },

    buildScenery: function() {
        this.trackGroup = new THREE.Group();
        this.scene.add(this.trackGroup);

        // Grade de chão com estilo laboratório
        const gridHelper = new THREE.GridHelper(4000, 80, 0x1E293B, 0x121826);
        gridHelper.position.set(1200, -120, 0);
        this.trackGroup.add(gridHelper);

        this.rebuildTrackGeometry();
        this.buildFinishPortal();
    },

    rebuildTrackGeometry: function() {
        if (this.trackMesh) this.trackGroup.remove(this.trackMesh);
        if (this.curbsMesh) this.trackGroup.remove(this.curbsMesh);
        if (this.dashesMesh) this.trackGroup.remove(this.dashesMesh);

        const segments = this.segmentCount;
        const dx = this.trackLength / segments;
        const halfW = this.trackWidth / 2;

        const roadPos = [];
        const roadNorm = [];
        const roadUv = [];
        const roadIdx = [];

        // Malha da pista
        for (let i = 0; i <= segments; i++) {
            const x = i * dx - 200;
            const { y, slope } = this.getElevationAndSlope(x);
            const ny = 1;
            const nx = -slope;
            const len = Math.hypot(nx, ny);

            // Vértice esquerdo (Z = -halfW)
            roadPos.push(x, y, -halfW);
            roadNorm.push(nx / len, ny / len, 0);
            roadUv.push(0, i / segments * 20);

            // Vértice direito (Z = +halfW)
            roadPos.push(x, y, halfW);
            roadNorm.push(nx / len, ny / len, 0);
            roadUv.push(1, i / segments * 20);

            if (i < segments) {
                const a = i * 2;
                const b = i * 2 + 1;
                const c = (i + 1) * 2;
                const d = (i + 1) * 2 + 1;
                roadIdx.push(a, c, b);
                roadIdx.push(b, c, d);
            }
        }

        const roadGeo = new THREE.BufferGeometry();
        roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
        roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNorm, 3));
        roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
        roadGeo.setIndex(roadIdx);

        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x181e2b,
            roughness: 0.7,
            metalness: 0.1
        });
        this.trackMesh = new THREE.Mesh(roadGeo, roadMat);
        this.trackMesh.receiveShadow = true;
        this.trackGroup.add(this.trackMesh);

        // Faixa central pontilhada
        const dashPos = [];
        for (let i = 0; i <= segments; i++) {
            const x = i * dx - 200;
            const { y } = this.getElevationAndSlope(x);
            dashPos.push(new THREE.Vector3(x, y + 0.3, 0));
        }
        const dashGeo = new THREE.BufferGeometry().setFromPoints(dashPos);
        const dashMat = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 15,
            gapSize: 10,
            linewidth: 3
        });
        this.dashesMesh = new THREE.Line(dashGeo, dashMat);
        this.dashesMesh.computeLineDistances();
        this.trackGroup.add(this.dashesMesh);
    },

    buildFinishPortal: function() {
        this.finishPortal = new THREE.Group();

        // Pilares laterais
        const pillarGeo = new THREE.CylinderGeometry(4, 4, 80, 16);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2A374A, metalness: 0.8, roughness: 0.2 });
        
        const pLeft = new THREE.Mesh(pillarGeo, pillarMat);
        pLeft.position.set(0, 40, -this.trackWidth / 2 - 8);
        pLeft.castShadow = true;
        this.finishPortal.add(pLeft);

        const pRight = new THREE.Mesh(pillarGeo, pillarMat);
        pRight.position.set(0, 40, this.trackWidth / 2 + 8);
        pRight.castShadow = true;
        this.finishPortal.add(pRight);

        // Viga superior neon
        const beamGeo = new THREE.BoxGeometry(10, 8, this.trackWidth + 24);
        const beamMat = new THREE.MeshStandardMaterial({ 
            color: 0x00E676,
            emissive: 0x00E676,
            emissiveIntensity: 0.6
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(0, 80, 0);
        this.finishPortal.add(beam);

        // Linha no chão
        const lineGeo = new THREE.PlaneGeometry(12, this.trackWidth);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x00E676, transparent: true, opacity: 0.85 });
        const floorLine = new THREE.Mesh(lineGeo, lineMat);
        floorLine.rotation.x = -Math.PI / 2;
        floorLine.position.y = 0.5;
        this.finishPortal.add(floorLine);

        this.trackGroup.add(this.finishPortal);
        this.updateTargetLine(window.SIM_STATE ? window.SIM_STATE.setPoint : 600);
    },

    buildCar: function() {
        this.carModels.group = new THREE.Group();
        this.scene.add(this.carModels.group);

        // Chassi / Carroceria aerodinâmica
        const bodyGeo = new THREE.BoxGeometry(55, 14, 28);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x00F2FE, // Ciano de alta visibilidade
            metalness: 0.6,
            roughness: 0.3
        });
        this.carModels.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.carModels.body.position.y = 12;
        this.carModels.body.castShadow = true;
        this.carModels.group.add(this.carModels.body);

        // Cockpit / Cabine
        const roofGeo = new THREE.BoxGeometry(26, 10, 22);
        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            metalness: 0.9,
            roughness: 0.1
        });
        this.carModels.roof = new THREE.Mesh(roofGeo, roofMat);
        this.carModels.roof.position.set(-4, 23, 0);
        this.carModels.roof.castShadow = true;
        this.carModels.group.add(this.carModels.roof);

        // Faróis dianteiros iluminados
        const headlightGeo = new THREE.BoxGeometry(3, 4, 6);
        const headlightMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.8
        });
        const hLeft = new THREE.Mesh(headlightGeo, headlightMat);
        hLeft.position.set(27, 12, -9);
        const hRight = new THREE.Mesh(headlightGeo, headlightMat);
        hRight.position.set(27, 12, 9);
        this.carModels.group.add(hLeft, hRight);

        // Rodas esportivas com cubos
        const wheelGeo = new THREE.CylinderGeometry(7, 7, 5, 20);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const rimGeo = new THREE.CylinderGeometry(4, 4, 5.2, 12);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8 });

        const wheelPositions = [
            [-18, 7, 15], [18, 7, 15],
            [-18, 7, -15], [18, 7, -15]
        ];

        this.carModels.wheels = [];
        wheelPositions.forEach(pos => {
            const wheelGroup = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeo, wheelMat);
            tire.rotation.x = Math.PI / 2;
            tire.castShadow = true;
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.x = Math.PI / 2;

            wheelGroup.add(tire);
            wheelGroup.add(rim);
            wheelGroup.position.set(...pos);

            this.carModels.wheels.push(wheelGroup);
            this.carModels.group.add(wheelGroup);
        });

        this.carModels.group.position.set(0, 0, 0);
    },

    updateTargetLine: function(val) {
        if (this.finishPortal) {
            const { y, angle } = this.getElevationAndSlope(val);
            this.finishPortal.position.set(val, y, 0);
            this.finishPortal.rotation.z = angle;
        }
    },

    updateTransform: function(position, velocity, acceleration, dt) {
        if (this.carModels && this.carModels.group) {
            const { y, angle } = this.getElevationAndSlope(position);

            this.carModels.group.position.x = position;
            this.carModels.group.position.y = y;

            // Rotação: inclinação do relevo + inércia de aceleração (pitch dinâmico)
            const accelTilt = THREE.MathUtils.clamp(acceleration * 0.003, -0.08, 0.08);
            const targetRotationZ = angle - accelTilt;
            this.carModels.group.rotation.z = THREE.MathUtils.lerp(this.carModels.group.rotation.z, targetRotationZ, 0.2);

            // Rotação contínua das rodas
            const wheelRot = (velocity * dt) / 7;
            if (this.carModels.wheels) {
                this.carModels.wheels.forEach(w => {
                    w.rotation.z -= wheelRot;
                });
            }

            // Câmera acompanha suavemente o carro
            const targetCamX = THREE.MathUtils.clamp(position + 200, 300, this.trackLength - 500);
            const targetCamY = y + 550;
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.08);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.08);
            this.camera.lookAt(this.camera.position.x, y + 50, 0);
        }
    },

    reset: function() {
        if (this.carModels && this.carModels.group) {
            const { y, angle } = this.getElevationAndSlope(0);
            this.carModels.group.position.set(0, y, 0);
            this.carModels.group.rotation.z = angle;
            this.camera.position.set(300, 550, 700);
            this.camera.lookAt(300, 50, 0);
        }
    },

    _renderLoop: function() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
        this._raf = requestAnimationFrame(this._renderLoop);
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
        this.carModels = {};
        this.trackGroup = null;
        this.finishPortal = null;
    }
};
