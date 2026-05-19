/**
 * CENA 3D — FASE 3: NAVIO ATRACANDO COM CORRENTES OCEÂNICAS
 * Controle de posição lateral com correntes senoidais persistentes e ondas.
 * Câmera vista de cima (top-down). Navio se move lateralmente para o cais.
 */

window.SceneShip = {
    scene: null,
    camera: null,
    renderer: null,
    ship: null,
    dockTarget: null,     // Poste/cais visual do alvo
    waves: [],            // Planos de onda animados
    currentArrows: [],    // Setas de corrente oceânica
    wakeParticles: [],    // Esteira do navio
    seaPlane: null,
    frustumSize: 280,
    _raf: null,
    _lastTime: null,
    _waveTime: 0,

    init: function(containerId, setPoint) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#0a1628");

        const aspect = container.clientWidth / container.clientHeight;
        this.frustumSize = 280; // Zoom in ajustado
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2,
             this.frustumSize * aspect / 2,
             this.frustumSize / 2,
            -this.frustumSize / 2,
            1, 3000
        );
        // Vista levemente de cima e da lateral
        this.camera.position.set(250, 600, 500);
        this.camera.lookAt(250, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Luzes
        const ambient = new THREE.AmbientLight(0x334455, 1.2); // Mais claro
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffeedd, 1.5); // Mais intenso
        sun.position.set(300, 500, 300);
        sun.castShadow = true;
        this.scene.add(sun);

        // Luz de preenchimento azulada do oceano
        const fillLight = new THREE.HemisphereLight(0x223355, 0x001122, 0.5);
        this.scene.add(fillLight);

        this.buildScene(setPoint);

        this._renderLoop = this._renderLoop.bind(this);
        this._raf = requestAnimationFrame(this._renderLoop);
    },

    buildScene: function(setPoint) {
        // --- OCEANO (Grade de planos para simular ondas) ---
        const seaGeo = new THREE.PlaneGeometry(1200, 1000, 40, 40);
        const seaMat = new THREE.MeshStandardMaterial({
            color: 0x0d3b59,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.1
        });
        this.seaPlane = new THREE.Mesh(seaGeo, seaMat);
        this.seaPlane.rotation.x = -Math.PI / 2;
        this.seaPlane.position.set(250, 0, 0);
        this.seaPlane.receiveShadow = true;
        this.scene.add(this.seaPlane);

        // --- CAIS/PORTO (direita da tela, posição X fixa ~450) ---
        const dockZ = -200;
        this._buildDock(setPoint, dockZ);

        // --- FAROL ---
        this._buildLighthouse();

        // --- CAIS DE FUNDO ---
        const pierGeo = new THREE.BoxGeometry(20, 8, 600);
        const pierMat = new THREE.MeshStandardMaterial({ color: 0x8B6914 });
        const pier = new THREE.Mesh(pierGeo, pierMat);
        pier.position.set(440, 4, dockZ + 100);
        pier.castShadow = true;
        this.scene.add(pier);

        // --- SETAS DE CORRENTE ---
        this.currentArrows = [];
        for (let i = 0; i < 6; i++) {
            const arrow = this._makeCurrentArrow();
            arrow.position.set(50 + i * 60, 6, -50 + (i % 3) * 40);
            arrow.userData.baseX = arrow.position.x;
            this.scene.add(arrow);
            this.currentArrows.push(arrow);
        }

        // --- NAVIO ---
        this._buildShip();
        this.ship.position.set(0, 0, dockZ + 100);

        // --- ALVO (boia/guia do cais) ---
        this.dockTarget = new THREE.Group();
        const buoyGeo = new THREE.CylinderGeometry(3, 3, 6, 8);
        const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0x441100 });
        const buoy = new THREE.Mesh(buoyGeo, buoyMat);
        buoy.position.y = 3;
        this.dockTarget.add(buoy);

        // Poste de amarração
        const postGeo = new THREE.CylinderGeometry(0.8, 0.8, 20, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0xddbb00 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = 10;
        this.dockTarget.add(post);

        this.dockTarget.position.set(setPoint, 0, dockZ + 100);
        this.scene.add(this.dockTarget);
    },

    _buildDock: function(setPoint, dockZ) {
        // Plataforma do cais
        const platGeo = new THREE.BoxGeometry(60, 6, 100);
        const platMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.position.set(setPoint, 3, dockZ + 50);
        plat.castShadow = true;
        this.scene.add(plat);

        // Pilares do cais
        for (let p = 0; p < 3; p++) {
            const pilGeo = new THREE.CylinderGeometry(2, 2, 30, 6);
            const pilMat = new THREE.MeshStandardMaterial({ color: 0x2e2015 });
            const pil = new THREE.Mesh(pilGeo, pilMat);
            pil.position.set(setPoint - 20 + p * 20, -12, dockZ + 40);
            this.scene.add(pil);
        }

        // Linha guia de atracação (linha verde vertical no mar)
        const linePoints = [new THREE.Vector3(setPoint, 5, dockZ + 100), new THREE.Vector3(setPoint, 5, dockZ + 250)];
        const lineMat = new THREE.LineDashedMaterial({ color: 0x00ff88, dashSize: 8, gapSize: 4 });
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        const guideLine = new THREE.Line(lineGeo, lineMat);
        guideLine.computeLineDistances();
        this.guideLine = guideLine;
        this.guideLineSetPoint = setPoint;
        this.scene.add(guideLine);
    },

    _buildLighthouse: function() {
        const group = new THREE.Group();
        // Torre
        const towerGeo = new THREE.CylinderGeometry(4, 6, 50, 8);
        const towerMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = 25;
        tower.castShadow = true;
        group.add(tower);
        // Faixas vermelhas
        for (let s = 0; s < 3; s++) {
            const bandGeo = new THREE.CylinderGeometry(4.1, 5.2 - s * 0.3, 4, 8);
            const bandMat = new THREE.MeshBasicMaterial({ color: 0xcc2200 });
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.position.y = 10 + s * 12;
            group.add(band);
        }
        // Cúpula da luz
        const domeGeo = new THREE.SphereGeometry(5, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 53;
        group.add(dome);
        // Luz piscando
        const lightGeo = new THREE.SphereGeometry(2.5, 6, 6);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        this.lighthouseLight = new THREE.Mesh(lightGeo, lightMat);
        this.lighthouseLight.position.y = 51;
        group.add(this.lighthouseLight);

        group.position.set(470, 0, -290);
        this.scene.add(group);
    },

    _makeCurrentArrow: function() {
        const group = new THREE.Group();
        // Seta horizontal indicando direção da corrente
        const shaftGeo = new THREE.CylinderGeometry(0.8, 0.8, 14, 5);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x2266ff, transparent: true, opacity: 0.7 });
        const shaft = new THREE.Mesh(shaftGeo, arrowMat);
        shaft.rotation.z = Math.PI / 2;
        shaft.position.x = 5;
        group.add(shaft);
        const headGeo = new THREE.ConeGeometry(2.5, 6, 5);
        const head = new THREE.Mesh(headGeo, arrowMat);
        head.rotation.z = -Math.PI / 2;
        head.position.x = 13;
        group.add(head);
        return group;
    },

    _buildShip: function() {
        this.ship = new THREE.Group();

        // Casco
        const hullGeo = new THREE.BoxGeometry(140, 14, 40);
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, flatShading: true });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.y = 7;
        hull.castShadow = true;
        this.ship.add(hull);

        // Linha d'água (faixa colorida)
        const waterlineGeo = new THREE.BoxGeometry(142, 2, 42);
        const waterlineMat = new THREE.MeshStandardMaterial({ color: 0xcc2200 });
        const waterline = new THREE.Mesh(waterlineGeo, waterlineMat);
        waterline.position.y = 3;
        this.ship.add(waterline);

        // Superestrutura (Torre principal)
        const superGeo = new THREE.BoxGeometry(40, 20, 30);
        const superMat = new THREE.MeshStandardMaterial({ color: 0xddddcc });
        const superStr = new THREE.Mesh(superGeo, superMat);
        superStr.position.set(-20, 24, 0);
        superStr.castShadow = true;
        this.ship.add(superStr);

        // Chaminé
        const chimneyGeo = new THREE.CylinderGeometry(3, 4, 15, 8);
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(-20, 42, 0);
        chimney.castShadow = true;
        this.ship.add(chimney);

        // Faixa colorida na chaminé
        const bandGeo = new THREE.CylinderGeometry(3.1, 3.5, 4, 8);
        const bandMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.set(-20, 38, 0);
        this.ship.add(band);

        // Proa (nariz do navio - cone)
        const proaGeo = new THREE.ConeGeometry(14, 25, 4, 1);
        const proaMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, flatShading: true });
        const proa = new THREE.Mesh(proaGeo, proaMat);
        proa.rotation.z = Math.PI / 2;
        proa.position.set(82, 7, 0);
        this.ship.add(proa);

        // Guindastes de carga
        for (let c = 0; c < 2; c++) {
            const craneBase = new THREE.BoxGeometry(6, 18, 6);
            const craneMat = new THREE.MeshStandardMaterial({ color: 0xdd8800 });
            const crane = new THREE.Mesh(craneBase, craneMat);
            crane.position.set(20 + c * 30, 22, 0);
            this.ship.add(crane);
            const armGeo = new THREE.BoxGeometry(25, 3, 3);
            const arm = new THREE.Mesh(armGeo, craneMat);
            arm.position.set(30 + c * 30, 32, 0);
            this.ship.add(arm);
        }

        // Esteira do navio (partículas de espuma)
        this.wakeParticles = [];
        this.scene.add(this.ship);
    },

    updateTargetLine: function(newTarget) {
        if (this.dockTarget) this.dockTarget.position.x = newTarget;
        if (this.guideLine) {
            const z = -200 + 100; // dockZ + 100
            const pts = [new THREE.Vector3(newTarget, 5, z), new THREE.Vector3(newTarget, 5, z + 150)];
            this.guideLine.geometry.setFromPoints(pts);
            this.guideLine.computeLineDistances();
        }
    },

    updateTransform: function(position, velocity, acceleration, dt) {
        if (!this.ship) return;
        this.ship.position.x = position;

        // Balanço do navio com as ondas
        const t = Date.now() * 0.001;
        this.ship.rotation.z = Math.sin(t * 0.8) * 0.04 + acceleration * 0.0005;
        this.ship.rotation.x = Math.sin(t * 0.6) * 0.015;

        // Corrente empurra navio
        this._animateCurrentArrows(dt);
        this._animateWaves(dt);
        this._animateLighthouse();
        this._spawnWake(position, velocity);
    },

    _animateWaves: function(dt) {
        if (!this.seaPlane) return;
        this._waveTime = (this._waveTime || 0) + dt;
        const t = this._waveTime;
        const pos = this.seaPlane.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const wave = Math.sin(x * 0.015 + t * 1.2) * 2.5 +
                         Math.sin(z * 0.02 + t * 0.9) * 1.5 +
                         Math.sin(x * 0.03 - z * 0.025 + t * 1.5) * 1;
            pos.setY(i, wave);
        }
        pos.needsUpdate = true;
        this.seaPlane.geometry.computeVertexNormals();
    },

    _animateCurrentArrows: function(dt) {
        const current = window.SIM_STATE.disturbance || 0;
        this.currentArrows.forEach((arrow, i) => {
            // Move setas na direção da corrente
            arrow.position.x += (current > 0 ? 1 : -1) * Math.abs(current) * 0.3 * dt;
            const base = arrow.userData.baseX;
            if (arrow.position.x > base + 80) arrow.position.x = base - 40;
            if (arrow.position.x < base - 80) arrow.position.x = base + 40;

            // Rotaciona para direção da corrente
            arrow.rotation.y = current > 0 ? 0 : Math.PI;

            // Opacidade com intensidade
            const opacity = Math.min(0.9, Math.abs(current) / 20 + 0.3);
            arrow.children.forEach(c => {
                if (c.material) c.material.opacity = opacity;
            });
        });
    },

    _animateLighthouse: function() {
        if (!this.lighthouseLight) return;
        const blink = Math.sin(Date.now() * 0.003) > 0.3;
        this.lighthouseLight.material.color.setHex(blink ? 0xffffaa : 0x444400);
    },

    _spawnWake: function(position, velocity) {
        if (Math.abs(velocity) < 1) return;
        // Adiciona partícula de espuma
        if (this.wakeParticles.length < 30) {
            const wakeGeo = new THREE.SphereGeometry(1.5 + Math.random() * 2, 4, 4);
            const wakeMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.5 });
            const wake = new THREE.Mesh(wakeGeo, wakeMat);
            wake.position.set(position - 70 * Math.sign(velocity), 2, this.ship ? this.ship.position.z : 0);
            wake.userData.life = 1.0;
            this.scene.add(wake);
            this.wakeParticles.push(wake);
        }
        // Fade nas partículas existentes
        this.wakeParticles = this.wakeParticles.filter(w => {
            w.userData.life -= 0.02;
            w.material.opacity = w.userData.life * 0.5;
            if (w.userData.life <= 0) {
                this.scene.remove(w);
                return false;
            }
            return true;
        });
    },

    reset: function() {
        if (this.ship) {
            this.ship.position.x = 0;
            this.ship.rotation.z = 0;
            this.ship.rotation.x = 0;
        }
        this.wakeParticles.forEach(w => this.scene.remove(w));
        this.wakeParticles = [];
        this._renderScene();
    },

    _renderLoop: function(ts) {
        if (!this.renderer) return;
        const dt = this._lastTime ? (ts - this._lastTime) / 1000 : 0.016;
        this._lastTime = ts;

        if (!window.SIM_STATE || !window.SIM_STATE.isRunning) {
            // Animações idle
            this._animateWaves(dt);
            this._animateLighthouse();
            this.currentArrows.forEach(a => {
                a.position.x += 0.3 * dt * 20;
                if (a.position.x > a.userData.baseX + 80) a.position.x = a.userData.baseX - 40;
            });
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
        this.ship = null;
        this.waves = [];
        this.currentArrows = [];
        this.wakeParticles = [];
    }
};
