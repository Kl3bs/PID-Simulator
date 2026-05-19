/**
 * CENA 3D — FASE 2: DRONE EM RAJADAS DE VENTO
 * Controle de altitude com perturbações de vento aleatórias e periódicas.
 * O drone tem hélices animadas e partículas de vento visíveis.
 */

window.SceneDrone = {
    scene: null,
    camera: null,
    renderer: null,
    drone: null,
    propellers: [],          // Malhas das hélices para animar
    windParticles: [],       // Linhas de vento animadas
    windArrow: null,         // Seta indicadora da força do vento atual
    altitudeRing: null,      // Anel visual da altitude alvo
    ground: null,
    altitudeIndicator: null, // Poste com marcação de altitude
    sky: null,               // Gradiente de céu (plano de fundo)
    clouds: [],              // Nuvens animadas
    frustumSize: 120,
    _raf: null,

    // Estado do vento (calculado aqui para animação)
    windState: {
        force: 0,
        gustTimer: 0,
        gustInterval: 3.5,  // Segundos entre rajadas
        gustMagnitude: 0,
        baseWind: 0,
        turbulence: 0
    },

    init: function(containerId, setPoint) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Limpa canvas anterior
        container.innerHTML = '';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#102233"); // Azul mais visível
        this.scene.fog = new THREE.Fog("#102233", 200, 600);

        const aspect = container.clientWidth / container.clientHeight;
        this.frustumSize = 120; // Ajustado para melhor visualização (Zoom in)
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2,
             this.frustumSize * aspect / 2,
             this.frustumSize / 2,
            -this.frustumSize / 2,
            1, 2000
        );
        this.camera.position.set(0, 50, 300);
        this.camera.lookAt(0, 50, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Luzes
        const ambient = new THREE.AmbientLight(0x99aabb, 1.8); // Aumentado
        this.scene.add(ambient);

        const moonLight = new THREE.DirectionalLight(0xccddee, 1.5); // Aumentado
        moonLight.position.set(-50, 100, 80);
        moonLight.castShadow = true;
        this.scene.add(moonLight);

        // Luz de destaque no drone
        this.droneSpot = new THREE.PointLight(0x00ccff, 2.5, 120);
        this.scene.add(this.droneSpot);

        // Luz de chão para iluminar de baixo
        const groundLight = new THREE.PointLight(0x334466, 2.0, 200);
        groundLight.position.set(0, 5, 0);
        this.scene.add(groundLight);

        this.buildScene(setPoint);
        this.windState.baseWind = 2 + Math.random() * 3;

        this._renderLoop = this._renderLoop.bind(this);
        this._lastTime = null;
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    buildScene: function(setPoint) {
        // Cor do chão ligeiramente mais clara
        const groundGeo = new THREE.PlaneGeometry(800, 800);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2540 });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = 0;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Grade de chão (visual de heliporto)
        const gridHelper = new THREE.GridHelper(200, 20, 0x112244, 0x112244);
        gridHelper.position.y = 0.1;
        this.scene.add(gridHelper);

        // Círculo de pouso (H de heliporto)
        const circleGeo = new THREE.RingGeometry(12, 14, 32);
        const circleMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
        const landingCircle = new THREE.Mesh(circleGeo, circleMat);
        landingCircle.rotation.x = -Math.PI / 2;
        landingCircle.position.set(0, 0.2, 0);
        this.scene.add(landingCircle);

        // Poste de referência de altitude (eixo Y visual)
        const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 110, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x334466, transparent: true, opacity: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(-35, 55, 0);
        this.scene.add(pole);

        // Marcas de altitude no poste
        for (let alt = 0; alt <= 100; alt += 10) {
            const markGeo = new THREE.BoxGeometry(alt % 50 === 0 ? 3 : 1.5, 0.4, 0.4);
            const markMat = new THREE.MeshBasicMaterial({ color: alt % 50 === 0 ? 0xffffff : 0x556688 });
            const mark = new THREE.Mesh(markGeo, markMat);
            mark.position.set(-34, alt, 0);
            this.scene.add(mark);
        }

        // Anel de altitude alvo
        const ringGeo = new THREE.TorusGeometry(8, 0.5, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        this.altitudeRing = new THREE.Mesh(ringGeo, ringMat);
        this.altitudeRing.position.set(0, setPoint, 0);
        this.altitudeRing.rotation.x = Math.PI / 2;
        this.scene.add(this.altitudeRing);

        // Linha pontilhada até o alvo
        const targetLineMat = new THREE.LineDashedMaterial({ color: 0x00ff88, dashSize: 2, gapSize: 2, linewidth: 1 });
        const points = [new THREE.Vector3(-35, setPoint, 0), new THREE.Vector3(35, setPoint, 0)];
        const targetLineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const targetLine = new THREE.Line(targetLineGeo, targetLineMat);
        targetLine.computeLineDistances();
        this.targetLineObj = targetLine;
        this.scene.add(targetLine);

        // --- NUVENS ---
        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            const cloud = this._makeCloud();
            cloud.position.set(-100 + Math.random() * 200, 60 + Math.random() * 40, -20 + Math.random() * 20);
            cloud.userData.speed = 0.5 + Math.random() * 1.5;
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }

        // --- PARTÍCULAS DE VENTO ---
        this.windParticles = [];
        this._spawnWindParticles();

        // --- SETA DE VENTO ---
        this._buildWindArrow();

        // --- DRONE ---
        this._buildDrone();
        this.drone.position.set(0, 0, 0);
    },

    _makeCloud: function() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.6 });
        const puffs = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < puffs; i++) {
            const r = 4 + Math.random() * 4;
            const geo = new THREE.SphereGeometry(r, 6, 6);
            const puff = new THREE.Mesh(geo, mat);
            puff.position.set((i - puffs / 2) * 6, Math.random() * 3, 0);
            group.add(puff);
        }
        return group;
    },

    _spawnWindParticles: function() {
        // Remove antigas
        this.windParticles.forEach(p => {
            if (p.parent) p.parent.remove(p);
        });
        this.windParticles = [];

        const wMat = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.5 });
        for (let i = 0; i < 18; i++) {
            const len = 4 + Math.random() * 6;
            const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(len, 0, 0)];
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geo, wMat.clone());
            line.position.set(
                -80 + Math.random() * 40,
                5 + Math.random() * 90,
                -10 + Math.random() * 20
            );
            line.userData.speed = 20 + Math.random() * 30;
            line.userData.baseY = line.position.y;
            this.scene.add(line);
            this.windParticles.push(line);
        }
    },

    _buildWindArrow: function() {
        // Grupo da seta que indica força e direção do vento
        const group = new THREE.Group();
        const shaftGeo = new THREE.CylinderGeometry(0.4, 0.4, 8, 6);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const shaft = new THREE.Mesh(shaftGeo, arrowMat);
        shaft.rotation.z = Math.PI / 2;
        shaft.position.x = 4;
        group.add(shaft);

        const headGeo = new THREE.ConeGeometry(1.2, 3, 6);
        const head = new THREE.Mesh(headGeo, arrowMat);
        head.rotation.z = -Math.PI / 2;
        head.position.x = 9;
        group.add(head);

        group.position.set(40, 75, 0);
        group.visible = false;
        this.windArrow = group;
        this.scene.add(group);
    },

    _buildDrone: function() {
        this.drone = new THREE.Group();

        // Corpo central
        const bodyGeo = new THREE.BoxGeometry(6, 2, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x445577, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        this.drone.add(body);

        // Cúpula de câmera
        const domeGeo = new THREE.SphereGeometry(1.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({ color: 0x111133 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = -1.2;
        this.drone.add(dome);

        // Lente da câmera
        const lensGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0033aa });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, -2, 0);
        this.drone.add(lens);

        // 4 Braços + hélices
        this.propellers = [];
        const armPositions = [
            { x: 6, z: 6 }, { x: -6, z: 6 },
            { x: 6, z: -6 }, { x: -6, z: -6 }
        ];
        const armMat = new THREE.MeshStandardMaterial({ color: 0x334466 });
        const propMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.8 });

        armPositions.forEach((pos, i) => {
            // Braço
            const armGeo = new THREE.CylinderGeometry(0.3, 0.3, 8.5, 4);
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.rotation.z = Math.PI / 2;
            arm.position.set(pos.x / 2, 0, pos.z / 2);
            arm.rotation.x = Math.atan2(pos.z, pos.x);
            const armGroup = new THREE.Group();
            armGroup.add(arm);

            // Motor (cilindro pequeno)
            const motorGeo = new THREE.CylinderGeometry(1, 1, 1.5, 8);
            const motorMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
            const motor = new THREE.Mesh(motorGeo, motorMat);
            motor.position.set(pos.x, 0, pos.z);
            this.drone.add(motor);

            // Hélice
            const propGroup = new THREE.Group();
            propGroup.position.set(pos.x, 0.5, pos.z);

            for (let b = 0; b < 2; b++) {
                const bladeGeo = new THREE.BoxGeometry(5, 0.15, 1);
                const blade = new THREE.Mesh(bladeGeo, propMat);
                blade.rotation.y = (b * Math.PI / 2);
                propGroup.add(blade);
            }
            this.drone.add(propGroup);
            this.propellers.push(propGroup);
        });

        // LEDs
        const ledColors = [0xff0000, 0xff0000, 0x00ff00, 0x00ff00];
        armPositions.forEach((pos, i) => {
            const ledGeo = new THREE.SphereGeometry(0.4, 6, 6);
            const ledMat = new THREE.MeshBasicMaterial({ color: ledColors[i] });
            const led = new THREE.Mesh(ledGeo, ledMat);
            led.position.set(pos.x, 0, pos.z);
            this.drone.add(led);
        });

        this.scene.add(this.drone);
    },

    updateTargetLine: function(newAlt) {
        if (this.altitudeRing) this.altitudeRing.position.y = newAlt;
        if (this.targetLineObj) {
            this.targetLineObj.position.y = 0;
            const pts = [new THREE.Vector3(-35, newAlt, 0), new THREE.Vector3(35, newAlt, 0)];
            this.targetLineObj.geometry.setFromPoints(pts);
            this.targetLineObj.computeLineDistances();
        }
    },

    updateTransform: function(altitude, velocity, acceleration, dt) {
        if (!this.drone) return;
        this.drone.position.y = altitude;

        // Gira hélices
        const propSpeed = 0.3 + Math.abs(velocity) * 0.05;
        this.propellers.forEach((p, i) => {
            p.rotation.y += (i % 2 === 0 ? propSpeed : -propSpeed);
        });

        // Inclinação por vento (eixo Z)
        const windTilt = (window.SIM_STATE.disturbance || 0) * 0.015;
        this.drone.rotation.z = Math.max(-0.3, Math.min(0.3, windTilt));

        // Inclinação por aceleração (eixo X)
        this.drone.rotation.x = Math.max(-0.2, Math.min(0.2, -acceleration * 0.02));

        // Luz de spotlight acompanha drone
        this.droneSpot.position.copy(this.drone.position);

        // Anima vento
        this._animateWind(dt);
    },

    _animateWind: function(dt) {
        const wind = window.SIM_STATE.disturbance || 0;
        const absWind = Math.abs(wind);

        // Partículas de vento
        this.windParticles.forEach(p => {
            p.position.x += (wind < 0 ? -1 : 1) * p.userData.speed * dt;
            if (p.position.x > 80) p.position.x = -80;
            if (p.position.x < -80) p.position.x = 80;

            // Opacidade baseada na intensidade do vento
            p.material.opacity = Math.min(0.8, absWind / 30 + 0.2);
            p.material.color.setHex(absWind > 20 ? 0xff6644 : 0x4488ff);
        });

        // Seta de vento
        if (this.windArrow) {
            this.windArrow.visible = absWind > 3;
            const scale = Math.min(3, absWind / 10);
            this.windArrow.scale.x = scale;
            this.windArrow.rotation.z = wind < 0 ? Math.PI : 0;
        }

        // Nuvens se movem com o vento
        this.clouds.forEach(c => {
            c.position.x += (wind < 0 ? -1 : 1) * c.userData.speed * dt * 0.5;
            if (c.position.x > 120) c.position.x = -120;
            if (c.position.x < -120) c.position.x = 120;
        });

        // Pisca anel de alvo
        if (this.altitudeRing) {
            const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
            this.altitudeRing.material.opacity = pulse;
            this.altitudeRing.material.transparent = true;
        }
    },

    reset: function() {
        if (this.drone) this.drone.position.y = 0;
        if (this.drone) {
            this.drone.rotation.z = 0;
            this.drone.rotation.x = 0;
        }
        this._renderScene();
    },

    _renderLoop: function(ts) {
        if (!this.renderer) return;
        const dt = this._lastTime ? (ts - this._lastTime) / 1000 : 0.016;
        this._lastTime = ts;

        // Anima nuvens independente de simulação
        if (!window.SIM_STATE || !window.SIM_STATE.isRunning) {
            this.clouds.forEach(c => { c.position.x += c.userData.speed * dt * 0.3; if (c.position.x > 120) c.position.x = -120; });
            this.propellers.forEach((p, i) => { p.rotation.y += (i % 2 === 0 ? 0.1 : -0.1); });
        }

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
        this.drone = null;
        this.propellers = [];
        this.windParticles = [];
        this.clouds = [];
    }
};
