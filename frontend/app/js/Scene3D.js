/**
 * MÓDULO DE RENDERIZAÇÃO 3D (FASE 1)
 * Responsável por desenhar a pista, o carro e a linha de chegada.
 */
window.Scene3D = {
    scene: null,
    camera: null,
    renderer: null,
    carModels: {}, // Referências para o corpo e teto do carro
    trackGroup: null,
    finishLine: null,
    _raf: null,
    
    frustumSize: 400, // Tamanho da visualização (Zoom)

    init: function(containerId, setPoint = 600) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        window.ActiveScene = this;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#FF6B35"); // Laranja de fundo

        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2, this.frustumSize * aspect / 2,
            this.frustumSize / 2, -this.frustumSize / 2,
            1, 3000
        );
        this.camera.position.set(500, 1000, 1000);
        this.camera.lookAt(500, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        this.buildLighting();
        this.buildScenery();
        this.buildCar();

        this.updateTargetLine = this.updateTargetLine.bind(this);
        this.updateTransform = this.updateTransform.bind(this);
        this.reset = this.reset.bind(this);
        
        this._renderLoop = this._renderLoop.bind(this);
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    buildLighting: function() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(500, 1000, 500);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -1000;
        dirLight.shadow.camera.right = 1000;
        dirLight.shadow.camera.top = 1000;
        dirLight.shadow.camera.bottom = -1000;
        dirLight.shadow.camera.far = 3000;
        this.scene.add(dirLight);
    },

    buildScenery: function() {
        this.trackGroup = new THREE.Group();
        this.scene.add(this.trackGroup);

        const roadWidth = 200;
        const roadLength = 3000;

        // Chão/Estrada
        const roadGeo = new THREE.PlaneGeometry(roadLength, roadWidth);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(roadLength / 2 - 500, 0, 0);
        road.receiveShadow = true;
        this.trackGroup.add(road);

        // Faixas da Pista
        const dashGeo = new THREE.PlaneGeometry(roadLength, 5);
        const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dashes = new THREE.Mesh(dashGeo, dashMat);
        dashes.rotation.x = -Math.PI / 2;
        dashes.position.set(roadLength / 2 - 500, 0.5, 0);
        this.trackGroup.add(dashes);

        // Linha Verde de Meta
        const finishGeo = new THREE.PlaneGeometry(10, roadWidth);
        const finishMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
        this.finishLine = new THREE.Mesh(finishGeo, finishMat);
        this.finishLine.rotation.x = -Math.PI / 2;
        this.finishLine.name = "finishLine";
        this.finishLine.position.set(window.SIM_STATE ? window.SIM_STATE.setPoint : 600, 0.2, 0);
        this.trackGroup.add(this.finishLine);
    },

    buildCar: function() {
        this.carModels.group = new THREE.Group();
        this.scene.add(this.carModels.group);

        // Corpo
        const bodyGeo = new THREE.BoxGeometry(60, 15, 30);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1A1A2E });
        this.carModels.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.carModels.body.position.y = 12;
        this.carModels.body.castShadow = true;
        this.carModels.group.add(this.carModels.body);

        // Teto
        const roofGeo = new THREE.BoxGeometry(30, 12, 26);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
        this.carModels.roof = new THREE.Mesh(roofGeo, roofMat);
        this.carModels.roof.position.set(-5, 25, 0);
        this.carModels.roof.castShadow = true;
        this.carModels.group.add(this.carModels.roof);

        // Rodas
        const wheelGeo = new THREE.CylinderGeometry(8, 8, 4, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wheelPositions = [
            [-20, 8, 16], [20, 8, 16],
            [-20, 8, -16], [20, 8, -16]
        ];

        this.carModels.wheels = [];
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(...pos);
            wheel.castShadow = true;
            this.carModels.wheels.push(wheel);
            this.carModels.group.add(wheel);
        });

        this.carModels.group.position.x = 0;
    },

    updateTargetLine: function(val) {
        if (this.finishLine) {
            this.finishLine.position.x = val;
        }
    },

    updateTransform: function(position, velocity, acceleration, dt) {
        if (this.carModels && this.carModels.group) {
            this.carModels.group.position.x = position;
            
            // Anima as rodas girando
            const wheelRot = velocity * dt * 0.1;
            if (this.carModels.wheels) {
                this.carModels.wheels.forEach(w => {
                    w.rotation.y -= wheelRot; // Rotaciona as rodas visualmente
                });
            }
            
            // Inclina o carro levemente baseado na aceleração
            const tilt = THREE.MathUtils.clamp(acceleration * 0.005, -0.1, 0.1);
            this.carModels.group.rotation.z = THREE.MathUtils.lerp(this.carModels.group.rotation.z, -tilt, 0.1);
        }
    },

    reset: function() {
        if (this.carModels && this.carModels.group) {
            this.carModels.group.position.x = 0;
            this.carModels.group.rotation.z = 0;
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
        this.finishLine = null;
    }
};
