/**
 * MÓDULO DE RENDERIZAÇÃO 3D (FASE 1 - CIRCUITO LOW-POLY ARCADE RACING)
 * Visual 100% fiel à referência:
 * - Perspectiva isométrica/top-down de alta fidelidade
 * - Pista de asfalto com zebras vermelhas e brancas em blocos estilizados
 * - Linhas brancas de borda contínuas e faixa central pontilhada
 * - Gramado verde vibrante com colinas facetadas e relevo orgânico contínuo
 * - Cercas brancas post-and-rail contornando a pista e os morros
 * - Aglomerados de rochas facetadas low-poly em cinza granito
 * - Árvores low-poly com copas geométricas facetadas
 * - Carro esportivo laranja com scoop elevado no capô, vidros fumê/azulados e calotas prateadas
 * - Marcas de pneu (skid marks) no asfalto
 * - Rastro de fumaça geométrica low-poly saindo das rodas traseiras
 */
window.Scene3D = {
    scene: null,
    camera: null,
    renderer: null,
    carModels: {},
    trackGroup: null,
    groundMesh: null,
    trackMesh: null,
    curbsMesh: null,
    borderLinesMesh: null,
    dashesMesh: null,
    skidMarksMesh: null,
    fencesGroup: null,
    propsGroup: null,
    finishPortal: null,
    _raf: null,
    
    frustumSize: 200, // Câmera aproximada para maior detalhamento e sensação de velocidade
    currentTerrainMode: 'flat', // 'flat', 'incline', 'decline', 'wave'
    trackLength: 3200,
    trackWidth: 150,
    segmentCount: 180,

    // Sistema de partículas de fumaça low-poly
    smokePool: [],
    maxSmokePuffs: 40,
    smokeEmitTimer: 0,

    // Histórico de marcas de pneu (skid marks)
    skidPointsLeft: [],
    skidPointsRight: [],
    lastSkidPos: 0,

    init: function(containerId, setPoint = 600) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        window.ActiveScene = this;

        this.scene = new THREE.Scene();
        // Céu limpo e ensolarado
        this.scene.background = new THREE.Color(0x8FD5F8);
        this.scene.fog = new THREE.FogExp2(0x8FD5F8, 0.00028);

        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2, this.frustumSize * aspect / 2,
            this.frustumSize / 2, -this.frustumSize / 2,
            1, 4500
        );
        
        // Posição da câmera: ângulo isométrico superior diagonal aproximado (~57° elevação)
        this.camera.position.set(40, 280, 180);
        this.camera.lookAt(60, 12, -10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.buildLighting();
        this.buildScenery();
        this.buildCar();
        this.initSmokeParticles();

        this.updateTargetLine = this.updateTargetLine.bind(this);
        this.updateTransform = this.updateTransform.bind(this);
        this.setTerrainMode = this.setTerrainMode.bind(this);
        this.reset = this.reset.bind(this);
        
        this._renderLoop = this._renderLoop.bind(this);
        this._raf = requestAnimationFrame(this._renderLoop);

        window.addEventListener('resize', this._onResize.bind(this));
    },

    _onResize: function() {
        if (!this.renderer || !this.camera) return;
        const container = this.renderer.domElement.parentElement;
        if (!container) return;
        const aspect = container.clientWidth / container.clientHeight;
        this.camera.left = -this.frustumSize * aspect / 2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = -this.frustumSize / 2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    buildLighting: function() {
        // Luz hemisférica: céu azul e rebote quente da grama verde
        const hemiLight = new THREE.HemisphereLight(0x94D9FA, 0x487E28, 0.75);
        this.scene.add(hemiLight);

        // Sol quente direto com sombras bem desenhadas
        const sun = new THREE.DirectionalLight(0xFFF9EB, 1.15);
        sun.position.set(380, 850, 440);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.left = -1600;
        sun.shadow.camera.right = 1600;
        sun.shadow.camera.top = 900;
        sun.shadow.camera.bottom = -900;
        sun.shadow.camera.near = 100;
        sun.shadow.camera.far = 3200;
        sun.shadow.bias = -0.0003;
        this.scene.add(sun);

        // Luz de preenchimento azul para enriquecer as faces sombreadas dos polígonos
        const fillLight = new THREE.DirectionalLight(0x75BBE0, 0.35);
        fillLight.position.set(-350, 420, -420);
        this.scene.add(fillLight);
    },

    /**
     * Perfil de relevo h(x) da pista
     */
    getElevationAndSlope: function(x) {
        let y = 0;
        let slope = 0; // dy/dx

        switch (this.currentTerrainMode) {
            case 'incline': // Aclive (+15°)
                if (x >= 150 && x <= 650) {
                    const progress = (x - 150) / 500;
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

            case 'wave': // Relevo ondulado
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

        this.fencesGroup = new THREE.Group();
        this.trackGroup.add(this.fencesGroup);

        this.propsGroup = new THREE.Group();
        this.trackGroup.add(this.propsGroup);

        this.rebuildTrackGeometry();
        this.buildFinishPortal();
    },

    rebuildTrackGeometry: function() {
        // Remove elementos anteriores
        if (this.groundMesh) this.trackGroup.remove(this.groundMesh);
        if (this.trackMesh) this.trackGroup.remove(this.trackMesh);
        if (this.curbsMesh) this.trackGroup.remove(this.curbsMesh);
        if (this.borderLinesMesh) this.trackGroup.remove(this.borderLinesMesh);
        if (this.dashesMesh) this.trackGroup.remove(this.dashesMesh);
        if (this.skidMarksMesh) this.trackGroup.remove(this.skidMarksMesh);

        while (this.fencesGroup.children.length > 0) {
            this.fencesGroup.remove(this.fencesGroup.children[0]);
        }
        while (this.propsGroup.children.length > 0) {
            this.propsGroup.remove(this.propsGroup.children[0]);
        }

        const segments = this.segmentCount;
        const dx = this.trackLength / segments;
        const halfW = this.trackWidth / 2; // 75

        // ==========================================
        // 1. TERRENO E COLINAS VERDES FACETADAS (AMPLO E CONTÍNUO)
        // ==========================================
        const zGrid = [
            -1100, -850, -650, -480, -340, -220, -140, -halfW - 8,
            halfW + 8, 140, 220, 340, 480, 650, 850, 1100
        ];
        const numZ = zGrid.length;
        const groundPos = [];
        const groundIdx = [];

        for (let i = 0; i <= segments; i++) {
            const x = i * dx - 300;
            const { y: yBase } = this.getElevationAndSlope(x);

            for (let j = 0; j < numZ; j++) {
                const z = zGrid[j];
                const dist = Math.abs(z) - halfW;
                let y = yBase;

                if (dist > 15) {
                    // Colinas e encostas no fundo e na frente
                    if (z < 0) {
                        // Encostas ao fundo (Z negativo) - mais altas como na referência
                        const hill = Math.pow(dist / 32, 1.4) * 9.5;
                        const facetNoise = Math.sin(x * 0.012 + j * 1.1) * 16 + Math.cos(x * 0.02) * 10;
                        y = yBase + hill + facetNoise;
                    } else {
                        // Primeiro plano (Z positivo) - elevação suave para enquadramento limpo
                        const hill = Math.pow(dist / 42, 1.3) * 6;
                        const facetNoise = Math.sin(x * 0.01 + j * 0.9) * 10;
                        y = yBase + hill + facetNoise;
                    }
                } else {
                    y = yBase - 1.0; // Leve rebaixo sob o asfalto
                }

                groundPos.push(x, y, z);
            }
        }

        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < numZ - 1; j++) {
                const r1 = i * numZ;
                const r2 = (i + 1) * numZ;
                const a = r1 + j;
                const b = r1 + j + 1;
                const c = r2 + j;
                const d = r2 + j + 1;

                groundIdx.push(a, b, c);
                groundIdx.push(b, d, c);
            }
        }

        const groundGeo = new THREE.BufferGeometry();
        groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundPos, 3));
        groundGeo.setIndex(groundIdx);
        groundGeo.computeVertexNormals();

        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x5E9E36, // Verde gramado rico com contraste facetado
            roughness: 0.92,
            metalness: 0.04,
            flatShading: true,
            side: THREE.DoubleSide
        });
        this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
        this.groundMesh.receiveShadow = true;
        this.trackGroup.add(this.groundMesh);

        // ==========================================
        // 2. MALHA DA PISTA DE ASFALTO
        // ==========================================
        const roadPos = [];
        const roadNorm = [];
        const roadIdx = [];

        for (let i = 0; i <= segments; i++) {
            const x = i * dx - 300;
            const { y, slope } = this.getElevationAndSlope(x);
            const ny = 1;
            const nx = -slope;
            const len = Math.hypot(nx, ny);

            roadPos.push(x, y + 0.1, -halfW);
            roadNorm.push(nx / len, ny / len, 0);

            roadPos.push(x, y + 0.1, halfW);
            roadNorm.push(nx / len, ny / len, 0);

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
        roadGeo.setIndex(roadIdx);

        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x4B5563, // Cinza asfalto neutro autêntico de corrida
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true,
            side: THREE.DoubleSide
        });
        this.trackMesh = new THREE.Mesh(roadGeo, roadMat);
        this.trackMesh.receiveShadow = true;
        this.trackGroup.add(this.trackMesh);

        // ==========================================
        // 3. ZEBRAS (CURBS) VERMELHAS E BRANCAS
        // ==========================================
        const curbWidth = 13;
        const curbHeight = 2.2;
        const curbPos = [];
        const curbColors = [];
        const curbIdx = [];
        let curbCount = 0;

        const redColor = new THREE.Color(0xDE4834);
        const whiteColor = new THREE.Color(0xF6F8FA);

        for (let i = 0; i < segments; i++) {
            const x0 = i * dx - 300;
            const x1 = (i + 1) * dx - 300;
            const elev0 = this.getElevationAndSlope(x0);
            const elev1 = this.getElevationAndSlope(x1);

            // Alternância periódica vermelho/branco em blocos
            const isRed = Math.floor((x0 + 400) / 22) % 2 === 0;
            const col = isRed ? redColor : whiteColor;

            // Zebra Esquerda (Fundo / Z negativo)
            const zL0_in = -halfW;
            const zL0_out = -halfW - curbWidth;
            const yL0_in = elev0.y + 0.15;
            const yL0_out = elev0.y + curbHeight;

            const zL1_in = -halfW;
            const zL1_out = -halfW - curbWidth;
            const yL1_in = elev1.y + 0.15;
            const yL1_out = elev1.y + curbHeight;

            const baseL = curbCount;
            curbPos.push(
                x0, yL0_in, zL0_in,
                x0, yL0_out, zL0_out,
                x1, yL1_in, zL1_in,
                x1, yL1_out, zL1_out
            );
            for (let k = 0; k < 4; k++) curbColors.push(col.r, col.g, col.b);
            curbIdx.push(baseL, baseL + 2, baseL + 1);
            curbIdx.push(baseL + 1, baseL + 2, baseL + 3);
            curbCount += 4;

            // Zebra Direita (Primeiro Plano / Z positivo)
            const zR0_in = halfW;
            const zR0_out = halfW + curbWidth;
            const yR0_in = elev0.y + 0.15;
            const yR0_out = elev0.y + curbHeight;

            const zR1_in = halfW;
            const zR1_out = halfW + curbWidth;
            const yR1_in = elev1.y + 0.15;
            const yR1_out = elev1.y + curbHeight;

            const baseR = curbCount;
            curbPos.push(
                x0, yR0_in, zR0_in,
                x0, yR0_out, zR0_out,
                x1, yR1_in, zR1_in,
                x1, yR1_out, zR1_out
            );
            for (let k = 0; k < 4; k++) curbColors.push(col.r, col.g, col.b);
            curbIdx.push(baseR, baseR + 1, baseR + 2);
            curbIdx.push(baseR + 1, baseR + 3, baseR + 2);
            curbCount += 4;
        }

        const curbGeo = new THREE.BufferGeometry();
        curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
        curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
        curbGeo.setIndex(curbIdx);
        curbGeo.computeVertexNormals();

        const curbMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.72,
            metalness: 0.05,
            flatShading: true,
            side: THREE.DoubleSide
        });
        this.curbsMesh = new THREE.Mesh(curbGeo, curbMat);
        this.curbsMesh.castShadow = true;
        this.curbsMesh.receiveShadow = true;
        this.trackGroup.add(this.curbsMesh);

        // ==========================================
        // 4. LINHAS BRANCAS CONTÍNUAS NAS BORDAS
        // ==========================================
        const linePos = [];
        const lineIdx = [];
        const lWidth = 3.4;
        let lCount = 0;

        for (let i = 0; i < segments; i++) {
            const x0 = i * dx - 300;
            const x1 = (i + 1) * dx - 300;
            const y0 = this.getElevationAndSlope(x0).y + 0.22;
            const y1 = this.getElevationAndSlope(x1).y + 0.22;

            // Borda esquerda interna
            const bL = lCount;
            linePos.push(
                x0, y0, -halfW + 3,
                x0, y0, -halfW + 3 + lWidth,
                x1, y1, -halfW + 3,
                x1, y1, -halfW + 3 + lWidth
            );
            lineIdx.push(bL, bL + 2, bL + 1, bL + 1, bL + 2, bL + 3);
            lCount += 4;

            // Borda direita interna
            const bR = lCount;
            linePos.push(
                x0, y0, halfW - 3 - lWidth,
                x0, y0, halfW - 3,
                x1, y1, halfW - 3 - lWidth,
                x1, y1, halfW - 3
            );
            lineIdx.push(bR, bR + 1, bR + 2, bR + 1, bR + 3, bR + 2);
            lCount += 4;
        }

        const linesGeo = new THREE.BufferGeometry();
        linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
        linesGeo.setIndex(lineIdx);
        const linesMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        this.borderLinesMesh = new THREE.Mesh(linesGeo, linesMat);
        this.trackGroup.add(this.borderLinesMesh);

        // ==========================================
        // 5. FAIXA CENTRAL PONTILHADA
        // ==========================================
        const dashPos = [];
        for (let i = 0; i <= segments; i++) {
            const x = i * dx - 300;
            const { y } = this.getElevationAndSlope(x);
            dashPos.push(new THREE.Vector3(x, y + 0.32, 0));
        }
        const dashGeo = new THREE.BufferGeometry().setFromPoints(dashPos);
        const dashMat = new THREE.LineDashedMaterial({
            color: 0xFFFFFF,
            dashSize: 18,
            gapSize: 14,
            linewidth: 2.5
        });
        this.dashesMesh = new THREE.Line(dashGeo, dashMat);
        this.dashesMesh.computeLineDistances();
        this.trackGroup.add(this.dashesMesh);

        // ==========================================
        // 6. MARCAS DE PNEU (SKID MARKS) NO ASFALTO
        // ==========================================
        this.buildSkidMarks();

        // ==========================================
        // 7. CERCAS BRANCAS (POST-AND-RAIL FENCE)
        // ==========================================
        this.buildFences();

        // ==========================================
        // 8. ROCHAS FACETADAS E ÁRVORES LOW-POLY
        // ==========================================
        this.buildVegetationAndRocks();
    },

    buildSkidMarks: function() {
        // Tiras estáticas de borracha preta no asfalto sugerindo frenagens e curvas
        const skidGroup = new THREE.Group();
        const skidMat = new THREE.MeshBasicMaterial({
            color: 0x222830,
            transparent: true,
            opacity: 0.45
        });

        const tireOffsets = [-15, 15];
        tireOffsets.forEach(zOffset => {
            for (let x = -100; x < this.trackLength - 200; x += 180) {
                const len = 70 + Math.sin(x * 0.05) * 30;
                const { y: yStart } = this.getElevationAndSlope(x);
                const { y: yEnd } = this.getElevationAndSlope(x + len);

                const skidGeo = new THREE.PlaneGeometry(len, 3.2);
                const skid = new THREE.Mesh(skidGeo, skidMat);
                skid.rotation.x = -Math.PI / 2;
                skid.position.set(x + len / 2, (yStart + yEnd) / 2 + 0.18, zOffset + Math.sin(x * 0.02) * 5);
                skidGroup.add(skid);
            }
        });

        this.skidMarksMesh = skidGroup;
        this.trackGroup.add(this.skidMarksMesh);
    },

    buildFences: function() {
        const fenceMat = new THREE.MeshStandardMaterial({
            color: 0xF8FAFC, // Branco puro como na referência
            roughness: 0.55,
            metalness: 0.08,
            flatShading: true
        });

        const postGeo = new THREE.BoxGeometry(2.4, 18, 2.4);
        const railGeo = new THREE.BoxGeometry(36, 1.8, 1.2);

        // Cercas ao longo das duas margens da pista
        const zOffsets = [-this.trackWidth / 2 - 24, this.trackWidth / 2 + 24];
        const step = 36;

        zOffsets.forEach(zOffset => {
            for (let x = -280; x <= this.trackLength - 200; x += step) {
                const { y } = this.getElevationAndSlope(x);

                // Poste vertical com topo reto/facetado
                const post = new THREE.Mesh(postGeo, fenceMat);
                post.position.set(x, y + 9, zOffset);
                post.castShadow = true;
                post.receiveShadow = true;
                this.fencesGroup.add(post);

                // Duplo trilho horizontal
                if (x + step <= this.trackLength - 200) {
                    const nextElev = this.getElevationAndSlope(x + step);
                    const avgY = (y + nextElev.y) / 2;
                    const angle = Math.atan2(nextElev.y - y, step);

                    const rail1 = new THREE.Mesh(railGeo, fenceMat);
                    rail1.position.set(x + step / 2, avgY + 6.5, zOffset);
                    rail1.rotation.z = angle;
                    rail1.castShadow = true;
                    this.fencesGroup.add(rail1);

                    const rail2 = new THREE.Mesh(railGeo, fenceMat);
                    rail2.position.set(x + step / 2, avgY + 13, zOffset);
                    rail2.rotation.z = angle;
                    rail2.castShadow = true;
                    this.fencesGroup.add(rail2);
                }
            }
        });
    },

    buildVegetationAndRocks: function() {
        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x6E472A,
            roughness: 0.9,
            flatShading: true
        });
        const foliageMat1 = new THREE.MeshStandardMaterial({
            color: 0x3E8B2C,
            roughness: 0.85,
            flatShading: true
        });
        const foliageMat2 = new THREE.MeshStandardMaterial({
            color: 0x4AA034,
            roughness: 0.85,
            flatShading: true
        });
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x828D98, // Cinza granito estilizado
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true
        });

        // 1. Árvores Low-Poly no topo dos morros
        const trunkGeo = new THREE.CylinderGeometry(2.0, 3.0, 20, 6);
        const crownGeo1 = new THREE.DodecahedronGeometry(13, 0);
        const crownGeo2 = new THREE.DodecahedronGeometry(9, 0);

        for (let x = -200; x <= this.trackLength - 200; x += 130) {
            // No fundo (Z negativo)
            const zBack = -(this.trackWidth / 2 + 55 + (Math.abs(Math.sin(x * 0.025)) * 50));
            const { y: baseY } = this.getElevationAndSlope(x);
            const hillY = baseY + 18 + Math.abs(Math.sin(x * 0.012)) * 25;

            const treeGroup = new THREE.Group();
            treeGroup.position.set(x + (Math.sin(x * 0.1) * 12), hillY, zBack);

            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 10;
            trunk.castShadow = true;
            treeGroup.add(trunk);

            const foliage1 = new THREE.Mesh(crownGeo1, foliageMat1);
            foliage1.position.y = 24;
            foliage1.scale.set(1, 1.15, 1);
            foliage1.castShadow = true;
            treeGroup.add(foliage1);

            const foliage2 = new THREE.Mesh(crownGeo2, foliageMat2);
            foliage2.position.set(1.5, 32, 1);
            foliage2.scale.set(0.85, 0.95, 0.85);
            foliage2.castShadow = true;
            treeGroup.add(foliage2);

            this.propsGroup.add(treeGroup);
        }

        // 2. Aglomerado de Pedras Facetadas (como na referência no canto da grama)
        const rockGeo = new THREE.DodecahedronGeometry(7, 0);
        const rockClusters = [
            { cx: 60, cz: -110, count: 7 },
            { cx: 320, cz: 112, count: 6 },
            { cx: 640, cz: -112, count: 8 },
            { cx: 1100, cz: 115, count: 7 },
            { cx: 1600, cz: -110, count: 8 },
            { cx: 2100, cz: 112, count: 7 }
        ];

        rockClusters.forEach(cluster => {
            const { y: baseY } = this.getElevationAndSlope(cluster.cx);

            for (let k = 0; k < cluster.count; k++) {
                const rock = new THREE.Mesh(rockGeo, rockMat);
                const ox = (Math.sin(k * 1.8) * 20);
                const oz = (Math.cos(k * 1.4) * 16);
                const s = 0.65 + (Math.abs(Math.sin(k * 2.1)) * 0.85);

                rock.position.set(cluster.cx + ox, baseY + 3.2 * s, cluster.cz + oz);
                rock.scale.set(s * 1.15, s * 0.85, s * 1.1);
                rock.rotation.set(k * 0.7, k * 1.1, k * 0.4);
                rock.castShadow = true;
                rock.receiveShadow = true;
                this.propsGroup.add(rock);
            }
        });
    },

    buildFinishPortal: function() {
        this.finishPortal = new THREE.Group();

        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0xF4F6F8,
            roughness: 0.4,
            metalness: 0.25,
            flatShading: true
        });
        const redBandMat = new THREE.MeshStandardMaterial({
            color: 0xDE4834,
            roughness: 0.4,
            metalness: 0.2
        });

        const pGeo = new THREE.BoxGeometry(6.5, 80, 6.5);
        const pLeft = new THREE.Mesh(pGeo, pillarMat);
        pLeft.position.set(0, 40, -this.trackWidth / 2 - 5);
        pLeft.castShadow = true;
        this.finishPortal.add(pLeft);

        const pRight = new THREE.Mesh(pGeo, pillarMat);
        pRight.position.set(0, 40, this.trackWidth / 2 + 5);
        pRight.castShadow = true;
        this.finishPortal.add(pRight);

        // Listras vermelhas nos pilares
        [-this.trackWidth / 2 - 5, this.trackWidth / 2 + 5].forEach(z => {
            [18, 36, 54].forEach(y => {
                const band = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 7), redBandMat);
                band.position.set(0, y, z);
                this.finishPortal.add(band);
            });
        });

        // Viga superior do pórtico
        const beamGeo = new THREE.BoxGeometry(8, 12, this.trackWidth + 22);
        const beam = new THREE.Mesh(beamGeo, pillarMat);
        beam.position.set(0, 80, 0);
        beam.castShadow = true;
        this.finishPortal.add(beam);

        // Faixa com letreiro e quadriculado
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, 512, 128);

        const tSize = 20;
        for (let x = 0; x < 512; x += tSize) {
            for (let y = 0; y < 128; y += tSize) {
                if ((x < 70 || x > 440) && (Math.floor(x / tSize) + Math.floor(y / tSize)) % 2 === 0) {
                    ctx.fillStyle = '#F8FAFC';
                    ctx.fillRect(x, y, tSize, tSize);
                }
            }
        }
        ctx.fillStyle = '#FFDD00';
        ctx.font = 'bold 52px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏁 CHEGADA / META 🏁', 256, 64);

        const bannerTex = new THREE.CanvasTexture(canvas);
        const bannerGeo = new THREE.PlaneGeometry(this.trackWidth, 11);
        const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(-4.2, 80, 0);
        banner.rotation.y = -Math.PI / 2;
        this.finishPortal.add(banner);

        // Faixa quadriculada no asfalto
        const fCanvas = document.createElement('canvas');
        fCanvas.width = 128;
        fCanvas.height = 512;
        const fCtx = fCanvas.getContext('2d');
        const cSize = 32;
        for (let x = 0; x < 128; x += cSize) {
            for (let y = 0; y < 512; y += cSize) {
                fCtx.fillStyle = (Math.floor(x / cSize) + Math.floor(y / cSize)) % 2 === 0 ? '#FFFFFF' : '#111827';
                fCtx.fillRect(x, y, cSize, cSize);
            }
        }
        const fTex = new THREE.CanvasTexture(fCanvas);
        const lineGeo = new THREE.PlaneGeometry(16, this.trackWidth);
        const lineMat = new THREE.MeshBasicMaterial({ map: fTex, transparent: true, opacity: 0.95 });
        const floorLine = new THREE.Mesh(lineGeo, lineMat);
        floorLine.rotation.x = -Math.PI / 2;
        floorLine.position.y = 0.4;
        this.finishPortal.add(floorLine);

        this.trackGroup.add(this.finishPortal);
        this.updateTargetLine(window.SIM_STATE ? window.SIM_STATE.setPoint : 600);
    },

    buildCar: function() {
        this.carModels.group = new THREE.Group();
        this.scene.add(this.carModels.group);

        // Cores da imagem de referência:
        // Laranja vibrante clássico estilo carro esportivo / drift
        const bodyColor = 0xDE5228;
        const scoopColor = 0xB83A14;
        const glassColor = 0x94B8CB; // Vidro azul céu clássico
        const trimColor = 0x1E242E;
        const rimColor = 0xDCE3EA;

        const bodyMat = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.38,
            metalness: 0.25,
            flatShading: true
        });

        const scoopMat = new THREE.MeshStandardMaterial({
            color: scoopColor,
            roughness: 0.45,
            metalness: 0.3,
            flatShading: true
        });

        const trimMat = new THREE.MeshStandardMaterial({
            color: trimColor,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: true
        });

        const glassMat = new THREE.MeshStandardMaterial({
            color: glassColor,
            roughness: 0.15,
            metalness: 0.55,
            flatShading: true
        });

        // 1. Chassi principal
        const chassisGeo = new THREE.BoxGeometry(52, 9, 28);
        const chassis = new THREE.Mesh(chassisGeo, bodyMat);
        chassis.position.set(0, 9.5, 0);
        chassis.castShadow = true;
        this.carModels.group.add(chassis);

        // 2. Capô dianteiro com caimento suave
        const hoodGeo = new THREE.BoxGeometry(19, 3.8, 27);
        const hood = new THREE.Mesh(hoodGeo, bodyMat);
        hood.position.set(15.5, 14, 0);
        hood.rotation.z = -0.04;
        hood.castShadow = true;
        this.carModels.group.add(hood);

        // 3. Scoop no capô (detalhe marcante da referência)
        const scoopGeo = new THREE.BoxGeometry(9, 3.2, 8);
        const scoop = new THREE.Mesh(scoopGeo, scoopMat);
        scoop.position.set(15.5, 17, 0);
        scoop.castShadow = true;
        this.carModels.group.add(scoop);

        const scoopHole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 6.5), trimMat);
        scoopHole.position.set(19.8, 17, 0);
        this.carModels.group.add(scoopHole);

        // 4. Cabine e vidros facetados
        const cabinGeo = new THREE.BoxGeometry(24, 9.8, 24);
        const cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(-6, 19.8, 0);
        cabin.castShadow = true;
        this.carModels.group.add(cabin);

        // Teto na cor da carroceria
        const roofGeo = new THREE.BoxGeometry(21, 2.4, 24.5);
        const roof = new THREE.Mesh(roofGeo, bodyMat);
        roof.position.set(-6, 25.2, 0);
        roof.castShadow = true;
        this.carModels.group.add(roof);

        // Colunas e molduras dos vidros
        const pillarGeo = new THREE.BoxGeometry(2.5, 9.6, 24.6);
        const pFront = new THREE.Mesh(pillarGeo, bodyMat);
        pFront.position.set(5.5, 19.8, 0);
        const pBack = new THREE.Mesh(pillarGeo, bodyMat);
        pBack.position.set(-17, 19.8, 0);
        this.carModels.group.add(pFront, pBack);

        // 5. Para-choque e grade dianteira preta
        const bumperGeo = new THREE.BoxGeometry(3.8, 6.8, 28.2);
        const fBump = new THREE.Mesh(bumperGeo, trimMat);
        fBump.position.set(26.5, 8.5, 0);
        fBump.castShadow = true;
        this.carModels.group.add(fBump);

        // Faróis dianteiros iluminados
        const hlMat = new THREE.MeshStandardMaterial({
            color: 0xFFFBE8,
            emissive: 0xFFFBE8,
            emissiveIntensity: 0.95
        });
        const hlGeo = new THREE.BoxGeometry(1.5, 3.5, 5.2);
        const hlL = new THREE.Mesh(hlGeo, hlMat);
        hlL.position.set(28, 10, -9.5);
        const hlR = new THREE.Mesh(hlGeo, hlMat);
        hlR.position.set(28, 10, 9.5);
        this.carModels.group.add(hlL, hlR);

        // 6. Traseira / Para-choque traseiro e lanternas
        const rBump = new THREE.Mesh(bumperGeo, trimMat);
        rBump.position.set(-26.5, 8.5, 0);
        rBump.castShadow = true;
        this.carModels.group.add(rBump);

        const tlMat = new THREE.MeshStandardMaterial({
            color: 0xEF4444,
            emissive: 0xEF4444,
            emissiveIntensity: 0.85
        });
        const tlGeo = new THREE.BoxGeometry(1.5, 2.8, 4.8);
        const tlL = new THREE.Mesh(tlGeo, tlMat);
        tlL.position.set(-28, 10, -9.5);
        const tlR = new THREE.Mesh(tlGeo, tlMat);
        tlR.position.set(-28, 10, 9.5);
        this.carModels.group.add(tlL, tlR);

        // Retrovisores laterais
        const mirGeo = new THREE.BoxGeometry(2.8, 2.4, 2.4);
        const mirL = new THREE.Mesh(mirGeo, bodyMat);
        mirL.position.set(3, 16.5, -14);
        const mirR = new THREE.Mesh(mirGeo, bodyMat);
        mirR.position.set(3, 16.5, 14);
        this.carModels.group.add(mirL, mirR);

        // 7. Rodas Esportivas com Pneus Pretos e Calotas Prateadas
        const tireGeo = new THREE.CylinderGeometry(7.5, 7.5, 5.6, 18);
        const tireMat = new THREE.MeshStandardMaterial({
            color: 0x14171E,
            roughness: 0.9,
            flatShading: true
        });

        const rimGeo = new THREE.CylinderGeometry(4.3, 4.3, 5.8, 10);
        const rimMat = new THREE.MeshStandardMaterial({
            color: rimColor,
            metalness: 0.8,
            roughness: 0.25,
            flatShading: true
        });

        const wheelPositions = [
            [-15, 7.5, 14.5], [15, 7.5, 14.5],
            [-15, 7.5, -14.5], [15, 7.5, -14.5]
        ];

        this.carModels.wheels = [];
        wheelPositions.forEach(pos => {
            const wGroup = new THREE.Group();

            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.rotation.x = Math.PI / 2;
            tire.castShadow = true;
            wGroup.add(tire);

            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.x = Math.PI / 2;
            wGroup.add(rim);

            wGroup.position.set(...pos);
            this.carModels.wheels.push(wGroup);
            this.carModels.group.add(wGroup);
        });

        this.carModels.group.position.set(0, 0, 0);
    },

    /**
     * Sistema de fumaça geométrica low-poly (Dodecaedros brancos)
     */
    initSmokeParticles: function() {
        this.smokePool = [];
        const smokeGeo = new THREE.DodecahedronGeometry(2.6, 0);
        const smokeMat = new THREE.MeshStandardMaterial({
            color: 0xEEF2F6,
            roughness: 0.85,
            transparent: true,
            opacity: 0,
            flatShading: true
        });

        for (let i = 0; i < this.maxSmokePuffs; i++) {
            const puff = new THREE.Mesh(smokeGeo, smokeMat.clone());
            puff.visible = false;
            this.scene.add(puff);

            this.smokePool.push({
                mesh: puff,
                active: false,
                life: 0,
                maxLife: 0.85,
                vx: 0,
                vy: 0,
                vz: 0,
                scale: 1,
                rotSpeed: new THREE.Vector3()
            });
        }
    },

    emitSmoke: function(carX, carY, carZ, velocity) {
        const p = this.smokePool.find(item => !item.active);
        if (!p) return;

        // Emerge das rodas traseiras com leve variação lateral
        const sideOffset = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 5);
        p.mesh.position.set(carX - 17, carY + 3.2 + Math.random() * 2, carZ + sideOffset);

        p.mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        p.active = true;
        p.life = 0;
        p.maxLife = 0.7 + Math.random() * 0.35;
        p.scale = 0.75 + Math.random() * 0.45;
        p.mesh.scale.setScalar(p.scale);
        p.mesh.material.opacity = 0.9;
        p.mesh.visible = true;

        p.vx = -velocity * 0.16 + (Math.random() - 0.5) * 5;
        p.vy = 5 + Math.random() * 7;
        p.vz = (Math.random() - 0.5) * 7;

        p.rotSpeed.set(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        );
    },

    updateSmoke: function(dt) {
        this.smokePool.forEach(p => {
            if (!p.active) return;

            p.life += dt;
            if (p.life >= p.maxLife) {
                p.active = false;
                p.mesh.visible = false;
                return;
            }

            const progress = p.life / p.maxLife;

            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;

            p.mesh.rotation.x += p.rotSpeed.x * dt;
            p.mesh.rotation.y += p.rotSpeed.y * dt;
            p.mesh.rotation.z += p.rotSpeed.z * dt;

            // Expansão característica em formato de nuvem de fumaça poligonal
            const currentScale = p.scale * (1 + progress * 2.6);
            p.mesh.scale.setScalar(currentScale);

            p.mesh.material.opacity = (1 - progress) * 0.9;
        });
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
            const accelTilt = THREE.MathUtils.clamp(acceleration * 0.003, -0.09, 0.09);
            const targetRotationZ = angle - accelTilt;
            this.carModels.group.rotation.z = THREE.MathUtils.lerp(
                this.carModels.group.rotation.z, targetRotationZ, 0.2
            );

            // Efeito dinâmico de guinada / drift sutil na aceleração/frenagem (como na imagem de referência)
            const driftYaw = THREE.MathUtils.clamp(-acceleration * 0.00035, -0.07, 0.07);
            this.carModels.group.rotation.y = THREE.MathUtils.lerp(
                this.carModels.group.rotation.y, driftYaw, 0.15
            );

            // Rotação contínua das rodas
            const wheelRot = (velocity * dt) / 7.5;
            if (this.carModels.wheels) {
                this.carModels.wheels.forEach(w => {
                    w.rotation.z -= wheelRot;
                });
            }

            // Emissão de fumaça geométrica quando o carro está em movimento
            if (Math.abs(velocity) > 1.2 || Math.abs(acceleration) > 5) {
                this.smokeEmitTimer += dt;
                if (this.smokeEmitTimer > 0.045) {
                    this.smokeEmitTimer = 0;
                    this.emitSmoke(position, y, 0, velocity);
                }
            }

            this.updateSmoke(dt);

            // Câmera isométrica aproximada acompanhando o veículo com suavidade
            const targetCamX = THREE.MathUtils.clamp(position + 45, 60, this.trackLength - 200);
            const targetCamY = y + 280;
            const targetCamZ = 180;

            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.08);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.08);
            this.camera.position.z = targetCamZ;

            // Ponto de foco na pista ligeiramente à frente do veículo
            this.camera.lookAt(this.camera.position.x + 20, y + 10, -10);
        }
    },

    reset: function() {
        if (this.carModels && this.carModels.group) {
            const { y, angle } = this.getElevationAndSlope(0);
            this.carModels.group.position.set(0, y, 0);
            this.carModels.group.rotation.z = angle;
            this.camera.position.set(45, y + 280, 180);
            this.camera.lookAt(65, y + 10, -10);
        }
        if (this.smokePool) {
            this.smokePool.forEach(p => {
                p.active = false;
                if (p.mesh) p.mesh.visible = false;
            });
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
        if (this.smokePool) {
            this.smokePool.forEach(p => {
                if (p.mesh && p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh && p.mesh.material) p.mesh.material.dispose();
            });
            this.smokePool = [];
        }
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
