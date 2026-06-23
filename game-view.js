import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const CELL = 1.6, GAP = 0.12, SPACING = CELL + GAP;
const BOARD_SIZE = 4 * CELL + 3 * GAP;
function tileHeight(v) { const e = Math.log2(v) - 1; return .28 * Math.pow(1.2, e) }
const COLORS = {
  2: 0xfaf8ef, 4: 0xf5f0e0, 8: 0xf2b179, 16: 0xf59563, 32: 0xf67c5f, 64: 0xf65e3b,
  128: 0xedcf72, 256: 0xedcc61, 512: 0xedc850, 1024: 0xedc53f, 2048: 0xedc22e
};
const EMISSIVE = {
  2: 0x000000, 4: 0x000000, 8: 0x553322, 16: 0x553322, 32: 0x553322, 64: 0x553322,
  128: 0x554422, 256: 0x554422, 512: 0x554422, 1024: 0x554422, 2048: 0x665522
};

function cellPos(r, c) { return new THREE.Vector3((c - 1.5) * SPACING, 0, (r - 1.5) * SPACING) }

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

function easeOutBack(t) { const c = 1.70158; return 1 + --t * t * ((c + 1) * t + c) }
function easeInCubic(t) { return t * t * t }

function animationStep(totalSteps, currentStep, beginNumber, beginHeight, endNumber, endHeight) {
  if (!totalSteps) return [endNumber, endHeight];
  const p=currentStep/totalSteps
  const animate=(a, b, p)=>a+(b-a)*p
  return [
    Math.round(animate(beginNumber, endNumber, p)),
    animate(beginHeight, endHeight, p),
  ]
}

export class GameView {
  constructor(container = document.body) {
    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .1, 50);

    const isLowEnd = devicePixelRatio <= 1 && (navigator.hardwareConcurrency || 4) <= 4;
    this._renderer = new THREE.WebGLRenderer({ antialias: !isLowEnd, alpha: true });
    this._renderer.setSize(innerWidth, innerHeight);
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, isLowEnd ? 1 : 2));
    if (!isLowEnd) {
      this._renderer.shadowMap.enabled = true;
      this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.2;
    container.append(this._renderer.domElement);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    const dc = this._computeDefaultCamera();
    this._camera.position.set(dc.px, dc.py, dc.pz);
    this._controls.target.set(dc.tx, dc.ty, dc.tz);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = .08;
    this._controls.minDistance = 4;
    this._controls.maxDistance = Math.max(18, Math.hypot(dc.px - dc.tx, dc.py - dc.ty, dc.pz - dc.tz) * 1.5);
    this._controls.maxPolarAngle = Math.PI / 2.1;
    this._controls.addEventListener('change', () => { this._dirty = true; });
    this._controls.update();

    if ('ontouchstart' in window) this._setupTouchCamera();
    this._scene.add(this._camera);

    this._tileGroups = new Map();
    this._activeTweens = [];
    this._particles = [];
    this._cameraMode = false;
    this._dirty = true;

    this._setupLights();
    this._setupBackground();
    this._setupBoard();
    this._bindUI();
    this._bindResize();
  }

  get camera() { return this._camera }
  get controls() { return this._controls }
  get renderer() { return this._renderer }

  // ===== SETUP =====

  _setupLights() {
    this._scene.add(new THREE.AmbientLight(0xffccaa, .35));
    this._scene.add(new THREE.HemisphereLight(0xffd4b0, 0x554433, .5));

    const main = new THREE.DirectionalLight(0xfff0e0, 1.6);
    main.position.set(5, 12, 6);
    main.castShadow = true;
    main.shadow.mapSize.width = 1024;
    main.shadow.mapSize.height = 1024;
    main.shadow.camera.near = .5;
    main.shadow.camera.far = 30;
    main.shadow.camera.left = -6;
    main.shadow.camera.right = 6;
    main.shadow.camera.top = 6;
    main.shadow.camera.bottom = -6;
    main.shadow.bias = -.001;
    this._scene.add(main);

    const fill = new THREE.DirectionalLight(0xffbb88, .5);
    fill.position.set(-4, 6, -4);
    this._scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffcc99, .5);
    rim.position.set(-3, 2, 6);
    this._scene.add(rim);
  }

  _setupBackground() {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0a0a1a');
    g.addColorStop(.5, '#12122a');
    g.addColorStop(1, '#0f0f22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 256);
    this._scene.background = new THREE.CanvasTexture(c);

    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - .5) * 80;
    starPos[1] = Math.abs(starPos[1]) * 5 + 5;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8888ff, size: .04, transparent: true, opacity: .6 }));
    this._scene.add(stars);
  }

  _setupBoard() {
    const boardGeo = new RoundedBoxGeometry(BOARD_SIZE, .12, BOARD_SIZE, 2, .08);
    this._board = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a3e, roughness: .6, metalness: .3 }));
    this._board.position.y = -.06;
    this._board.receiveShadow = true;
    this._board.castShadow = true;
    this._scene.add(this._board);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_SIZE + .6, BOARD_SIZE + .6),
      new THREE.MeshBasicMaterial({ color: 0xedc22e, transparent: true, opacity: .04, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -.15;
    this._scene.add(glow);

    const gridMat = new THREE.LineBasicMaterial({ color: 0x2a2a5e, transparent: true, opacity: .5 });
    for (let i = 0; i <= 4; i++) {
      const t = -(BOARD_SIZE / 2) + i * SPACING;
      const a = new THREE.Vector3(t, 0, -BOARD_SIZE / 2);
      const b = new THREE.Vector3(t, 0, BOARD_SIZE / 2);
      const l1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), gridMat);
      l1.position.y = -.05;
      this._scene.add(l1);
      const c = new THREE.Vector3(-BOARD_SIZE / 2, 0, t);
      const d = new THREE.Vector3(BOARD_SIZE / 2, 0, t);
      const l2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([c, d]), gridMat);
      l2.position.y = -.05;
      this._scene.add(l2);
    }

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a5e, roughness: .5, metalness: .4, transparent: true, opacity: .8 });
    const fd = .12, fh = .06;
    for (const s of [
      { p: [0, 0, BOARD_SIZE / 2 + .1], sz: [BOARD_SIZE + .2, fh, fd] },
      { p: [0, 0, -BOARD_SIZE / 2 - .1], sz: [BOARD_SIZE + .2, fh, fd] },
      { p: [BOARD_SIZE / 2 + .1, 0, 0], sz: [fd, fh, BOARD_SIZE + .2] },
      { p: [-BOARD_SIZE / 2 - .1, 0, 0], sz: [fd, fh, BOARD_SIZE + .2] },
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...s.sz), frameMat);
      m.position.set(s.p[0], s.p[1] - .06, s.p[2]);
      this._scene.add(m);
    }

    const cmat = new THREE.MeshStandardMaterial({ color: 0x3a3a7e, roughness: .4, metalness: .5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.12, .08, .12), cmat);
      m.position.set(sx * (BOARD_SIZE / 2 + .1), -.02, sz * (BOARD_SIZE / 2 + .1));
      this._scene.add(m);
    }
  }

  _bindUI() {
    this._scoreEl = document.getElementById('score');
    this._bestEl = document.getElementById('best');
    this._modal = document.getElementById('modal');
    this._modalTitle = document.getElementById('modal-title');
    this._modalScore = document.getElementById('modal-score');
    this._modalSub = document.getElementById('modal-sub');
  }

  _bindResize() {
    let timer;
    window.addEventListener('resize', () => {
      this._camera.aspect = innerWidth / innerHeight;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(innerWidth, innerHeight);
      clearTimeout(timer);
      timer = setTimeout(() => { this.resetCamera(); }, 500);
    });
  }

  // ===== TILE MANAGEMENT =====

  _createTileCanvas(value) {
    const color = COLORS[value] || 0xedc22e;
    const r0 = (color >> 16) & 0xff, g0 = (color >> 8) & 0xff, b0 = color & 0xff;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${r0},${g0},${b0})`;
    ctx.fillRect(0, 0, 256, 256);
    const img = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - .5) * 14;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    const fs = value >= 1000 ? 70 : value >= 100 ? 90 : 115;
    ctx.font = `900 ${fs}px Arial,"Hiragino Sans","Noto Sans JP",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const str = String(value);
    const dark = r0 * .299 + g0 * .587 + b0 * .114 > 160;
    const tc = dark ? '#776e65' : '#f9f6f2';

    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = dark ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.25)';
    ctx.fillText(str, 129, 134);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.2)';
    ctx.fillText(str, 126, 130);

    ctx.fillStyle = tc;
    ctx.fillText(str, 128, 132);
    ctx.restore();
    return canvas;
  }

  _createTileBumpMap(value) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    const fs = value >= 1000 ? 70 : value >= 100 ? 90 : 115;
    ctx.font = `900 ${fs}px Arial,"Hiragino Sans","Noto Sans JP",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const str = String(value);

    ctx.save();
    ctx.shadowColor = '#555';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#444';
    ctx.fillText(str, 128, 132);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#333';
    ctx.fillText(str, 128, 132);
    ctx.restore();
    return canvas;
  }

  _createTileMesh(value) {
    const h = tileHeight(value);
    const emis = EMISSIVE[value] || 0x554422;
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(CELL, h, CELL, 2, .08),
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(this._createTileCanvas(value)),
        bumpMap: new THREE.CanvasTexture(this._createTileBumpMap(value)),
        bumpScale: .025,
        roughness: .7, metalness: .52, emissive: emis, emissiveIntensity: .03
      })
    );
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.y = h / 2;
    const group = new THREE.Group();
    group.add(mesh);
    group.userData = { value, height: h };
    return group;
  }

  spawnTile(tile) {
    const pos = cellPos(tile.row, tile.col);
    const g = this._createTileMesh(tile.value);
    g.position.copy(pos);
    g.scale.setScalar(0);
    this._scene.add(g);
    this._tileGroups.set(tile.id, g);
    g.userData.tileId = tile.id;
    return g;
  }

  removeTile(id) {
    const g = this._tileGroups.get(id);
    if (!g) return null;
    this._cancelValueTransition(g);
    this._scene.remove(g);
    g.traverse(child => {
      if (child.isMesh) {
        child.geometry && child.geometry.dispose();
        child.material && child.material.dispose();
      }
    });
    this._tileGroups.delete(id);
    return g;
  }

  hasTile(id) { return this._tileGroups.has(id) }

  clearAll() {
    this._board.scale.set(1, 1, 1);
    for (const [id] of this._tileGroups) this.removeTile(id);
    this._tileGroups.clear();
  }

  getTileGroup(id) { return this._tileGroups.get(id) }

  restoreTile(tile) {
    const pos = cellPos(tile.row, tile.col);
    const g = this._createTileMesh(tile.value);
    g.position.copy(pos);
    g.scale.setScalar(1);
    this._scene.add(g);
    this._tileGroups.set(tile.id, g);
    g.userData.tileId = tile.id;
    return g;
  }

  _removeOrphans(grid) {
    const ids = new Set();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const t = grid[r][c];
      if (t) ids.add(t.id);
    }
    for (const [id] of this._tileGroups) {
      if (!ids.has(id)) this.removeTile(id);
    }
  }

  // ===== ANIMATION =====

  _tweenObj(obj, duration, target, onUpdate, onComplete, ease = easeOutCubic) {
    this._dirty = true;
    const start = Object.fromEntries(Object.entries(target).map(([k]) => [k, obj[k]]));
    this._activeTweens.push({ obj, target, start, duration, onUpdate, onComplete, ease, elapsed: 0 });
  }

  _updateTweens(dt) {
    for (let i = this._activeTweens.length - 1; i >= 0; i--) {
      const tw = this._activeTweens[i];
      tw.elapsed += dt;
      let t = Math.min(tw.elapsed / tw.duration, 1);
      const e = tw.ease(t);
      for (const [k, v] of Object.entries(tw.target)) {
        const s = tw.start[k];
        if (typeof v === 'number') tw.obj[k] = s + (v - s) * e;
        else if (v instanceof THREE.Vector3) {
          tw.obj[k].x = s.x + (v.x - s.x) * e;
          tw.obj[k].y = s.y + (v.y - s.y) * e;
          tw.obj[k].z = s.z + (v.z - s.z) * e;
        }
      }
      if (tw.onUpdate) tw.onUpdate(t);
      if (t >= 1) {
        if (tw.onComplete) tw.onComplete();
        this._activeTweens.splice(i, 1);
        this._dirty = true;
      }
    }
  }

  animateMoveTo(id, toR, toC, delay = 0) {
    return new Promise(resolve => {
      const g = this._tileGroups.get(id);
      if (!g) { resolve(); return; }
      const toPos = cellPos(toR, toC);
      toPos.y = g.position.y;
      setTimeout(() => {
        this._tweenObj(g, .12, { position: toPos }, null, resolve);
      }, delay);
    });
  }

  animateMergeTo(id, toR, toC) {
    return new Promise(resolve => {
      const g = this._tileGroups.get(id);
      if (!g) { resolve(); return; }
      const startPos = g.position.clone();
      const toPos = cellPos(toR, toC);
      toPos.y = startPos.y;
      this._tweenObj({ t: 0 }, .15, { t: 1 }, (t) => {
        g.position.lerpVectors(startPos, toPos, t);
      }, resolve);
    });
  }

  _cancelValueTransition(group) {
    const old = group.userData._valTween;
    if (old != null) {
      const idx = this._activeTweens.indexOf(old);
      if (idx >= 0) this._activeTweens.splice(idx, 1);
      group.userData._valTween = null;
    }
  }

  _animateValueTransition(group, newValue) {
    const mesh = group.children[0];
    const oldValue = group.userData.value;
    const oldH = tileHeight(oldValue);
    const newH = tileHeight(newValue);

    this._cancelValueTransition(group);

    mesh.scale.set(1, 1, 1);
    mesh.position.y = oldH / 2;

    const textures = [];
    const step = oldValue < newValue ? 1 : -1;
    for (let v = oldValue + step; step > 0 ? v <= newValue : v >= newValue; v += step) {
      textures.push({
        value: v,
        tex: new THREE.CanvasTexture(this._createTileCanvas(v)),
        bump: new THREE.CanvasTexture(this._createTileBumpMap(v)),
      });
    }

    this._tweenObj({ t: 0 }, .5, { t: 1 }, (t) => {
      const texIdx = Math.floor(t * textures.length);
      const [, h] = animationStep(textures.length, texIdx, oldValue, oldH, newValue, newH);
      mesh.scale.y = h / oldH;
      mesh.position.y = h / 2;
      if (texIdx >= 0 && texIdx < textures.length && mesh.material.map !== textures[texIdx].tex) {
        mesh.material.map = textures[texIdx].tex;
        mesh.material.bumpMap = textures[texIdx].bump;
        mesh.material.needsUpdate = true;
      }
    }, () => {
      const finalTex = new THREE.CanvasTexture(this._createTileCanvas(newValue));
      const finalBump = new THREE.CanvasTexture(this._createTileBumpMap(newValue));
      mesh.material.map = finalTex;
      mesh.material.bumpMap = finalBump;
      mesh.material.needsUpdate = true;
      const oldGeo = mesh.geometry;
      mesh.geometry = new RoundedBoxGeometry(CELL, newH, CELL, 2, .08);
      oldGeo.dispose();
      mesh.scale.set(1, 1, 1);
      mesh.position.y = newH / 2;
      group.userData.value = newValue;
      group.userData.height = newH;
      group.userData._valTween = null;
    });
    group.userData._valTween = this._activeTweens[this._activeTweens.length - 1];
  }

  animateSpawn(group, delay = 0) {
    setTimeout(() => {
      group.scale.setScalar(.01);
      this._tweenObj(group, .2, { scale: new THREE.Vector3(1, 1, 1) });
    }, delay);
  }

  // ===== PARTICLES & FLASH =====

  _emitParticles(position, color, count = 15) {
    for (let i = 0; i < count; i++) {
      const size = .025 + Math.random() * .035;
      const c = new THREE.Color(color);
      c.offsetHSL((Math.random() - .5) * .05, 0, (Math.random() - .5) * .1);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({ color: c, transparent: true })
      );
      mesh.position.copy(position);
      mesh.position.y += .35;
      const speed = .08 + Math.random() * .15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      mesh.userData.vel = new THREE.Vector3(speed * Math.sin(phi) * Math.cos(theta), speed * Math.cos(phi) + .05, speed * Math.sin(phi) * Math.sin(theta));
      mesh.userData.life = 1;
      mesh.userData.decay = .008 + Math.random() * .015;
      this._scene.add(mesh);
      this._particles.push(mesh);
    }
    this._dirty = true;
  }

  _emitFlash(position, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    const c = '#' + Math.floor(color).toString(16).padStart(6, '0');
    g.addColorStop(0, c); g.addColorStop(.5, c + '88'); g.addColorStop(1, c + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true, blending: THREE.AdditiveBlending, opacity: .9, depthWrite: false
    }));
    sprite.position.copy(position); sprite.position.y += .2;
    sprite.scale.set(0, 0, 1);
    this._scene.add(sprite);
    this._tweenObj(sprite, .2, { scale: new THREE.Vector3(3, 3, 1) }, null, () => {
      this._tweenObj(sprite, .4, { scale: new THREE.Vector3(5, 5, 1) }, t => {
        sprite.material.opacity = 1 - t;
      }, () => {
        this._scene.remove(sprite);
        sprite.material.map.dispose();
        sprite.material.dispose();
      });
    });
  }

  _updateParticles(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.position.addScaledVector(p.userData.vel, dt * 60);
      p.userData.vel.y -= .003 * dt * 60;
      p.userData.life -= p.userData.decay * dt * 60;
      p.material.opacity = Math.max(0, p.userData.life);
      p.scale.setScalar(Math.max(0, p.userData.life));
      if (p.userData.life <= 0) {
        this._scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this._particles.splice(i, 1);
      }
    }
  }

  // ===== EFFECTS =====

  _cancelTweens(obj) {
    for (let i = this._activeTweens.length - 1; i >= 0; i--) {
      if (this._activeTweens[i].obj === obj) this._activeTweens.splice(i, 1);
    }
  }

  animateGameOver(callback) {
    const tiles = Array.from(this._tileGroups.values());
    if (!tiles.length) { callback?.(); return; }
    this._tweenObj(this._board.scale, .3, { x: 0, y: 0, z: 0 });
    let count = 0;
    for (const g of tiles) {
      const ox = g.position.x, oy = g.position.y, oz = g.position.z;
      this._tweenObj(g.position, .04, { x: ox - .12, y: oy, z: oz }, null, () => {
        this._tweenObj(g.position, .04, { x: ox + .1, y: oy, z: oz }, null, () => {
          this._tweenObj(g.position, .04, { x: ox - .06, y: oy, z: oz }, null, () => {
            this._tweenObj(g.position, .03, { x: ox, y: oy, z: oz }, null, () => {
              if (++count === tiles.length) {
                let fall = 0;
                for (const [i, g2] of tiles.entries()) {
                  setTimeout(() => {
                    g2.rotation.z = (Math.random() - .5) * .4;
                    this._tweenObj(g2.position, .6, { x: g2.position.x, y: -6, z: g2.position.z }, null, () => {
                      g2.visible = false;
                      if (++fall === tiles.length) callback?.();
                    }, easeInCubic);
                  }, i * 50);
                }
              }
            });
          });
        });
      });
    }
  }

  _emitExplosion(position, color) {
    const count = 150;
    const base = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const size = .015 + Math.random() * .06;
      const c = base.clone();
      c.offsetHSL((Math.random() - .5) * .08, 0, (Math.random() - .5) * .2);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({ color: c, transparent: true })
      );
      mesh.position.copy(position);
      mesh.position.y += .35;
      const speed = .08 + Math.random() * .4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      mesh.userData.vel = new THREE.Vector3(
        speed * Math.sin(phi) * Math.cos(theta),
        Math.abs(speed * Math.cos(phi)) + .06,
        speed * Math.sin(phi) * Math.sin(theta)
      );
      mesh.userData.life = 1;
      mesh.userData.decay = .003 + Math.random() * .01;
      this._scene.add(mesh);
      this._particles.push(mesh);
    }
    this._dirty = true;
  }

  _emitRejectEdgeEffect(dir) {
    const half = BOARD_SIZE / 2;
    const color = 0xff4433;
    const dirVec = { left: new THREE.Vector3(-1,0,0), right: new THREE.Vector3(1,0,0), up: new THREE.Vector3(0,0,-1), down: new THREE.Vector3(0,0,1) }[dir];
    if (!dirVec) return;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1)) - .5;
      const pos = new THREE.Vector3(
        dirVec.x !== 0 ? dirVec.x * half : t * BOARD_SIZE,
        .15 + Math.random() * .1,
        dirVec.z !== 0 ? dirVec.z * half : t * BOARD_SIZE
      );
      const numP = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numP; j++) {
        const size = .025 + Math.random() * .035;
        const c = new THREE.Color(color);
        c.offsetHSL((Math.random() - .5) * .05, 0, (Math.random() - .5) * .1);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size, size, size),
          new THREE.MeshBasicMaterial({ color: c, transparent: true })
        );
        mesh.position.copy(pos);
        const speed = .08 + Math.random() * .14;
        mesh.userData.vel = new THREE.Vector3(
          dirVec.x * speed + (Math.random() - .5) * .25,
          Math.random() * .06 + .02,
          dirVec.z * speed + (Math.random() - .5) * .25
        );
        mesh.userData.life = 1;
        mesh.userData.decay = .012 + Math.random() * .015;
        this._scene.add(mesh);
        this._particles.push(mesh);
      }
    }
  }

  rejectMove(dir) {
    const isH = dir === 'left' || dir === 'right';
    for (const [, group] of this._tileGroups) {
      const home = group.userData.homePos ?? group.position;
      const coord = isH ? 'x' : 'z';
      const origin = home[coord];
      this._cancelTweens(group.position);
      this._tweenObj(group.position, .04, { [coord]: origin + .15 }, null, () => {
        this._tweenObj(group.position, .04, { [coord]: origin - .12 }, null, () => {
          this._tweenObj(group.position, .03, { [coord]: origin }, null, () => {});
        });
      });
    }
    if (dir) this._emitRejectEdgeEffect(dir);
  }

  // ===== GRID SYNC (call after move animation completes) =====

  applyMoveResult(result, grid) {
    const gridById = new Map();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const t = grid[r][c];
      if (t) gridById.set(t.id, t);
    }
    const merges = new Map();
    for (const m of result.moves) {
      if (!m.merged) continue;
      if (!merges.has(m.newId)) merges.set(m.newId, []);
      merges.get(m.newId).push(m);
    }
    const pendingExplosions = [];
    for (const [newId, ms] of merges) {
      const anchor = ms.find(m => m.fromR === m.toR && m.fromC === m.toC);
      for (const m of ms) {
        if (m === anchor) continue;
        this.removeTile(m.id);
      }
      if (anchor) {
        const anchorGroup = this._tileGroups.get(anchor.id);
        const newTile = gridById.get(newId);
        if (anchorGroup && newTile) {
          this._tileGroups.set(newId, anchorGroup);
          this._tileGroups.delete(anchor.id);
          this._animateValueTransition(anchorGroup, newTile.value);
        }
      }
      const nTile = gridById.get(newId);
      if (nTile && nTile.value >= 512) {
        const mergePos = cellPos(ms[0].toR, ms[0].toC);
        pendingExplosions.push(mergePos);
      }
    }
    for (const pos of pendingExplosions) {
      setTimeout(() => {
        this._emitExplosion(pos, 0xf67c5f);
        this._emitFlash(pos, 0xf67c5f);
      }, 500);
    }

    this._removeOrphans(grid);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const t = grid[r][c];
        if (!t) continue;
        const target = cellPos(r, c);
        if (this._tileGroups.has(t.id)) {
          const g = this._tileGroups.get(t.id);
          if (g.position.distanceTo(target) > .01) {
            g.position.copy(target);
          }
          g.userData.homePos ??= target.clone();
          g.userData.homePos.copy(target);
        } else {
          const g = this.spawnTile(t);
          g.userData.homePos ??= target.clone();
          g.userData.homePos.copy(target);
          g.scale.setScalar(.01);
          this.animateSpawn(g, 50);
        }
      }
    }
  }

  // ===== UI =====

  updateScore(score, best) {
    this._scoreEl.textContent = score;
    this._bestEl.textContent = best;
  }

  showModal(title, scoreText, subText) {
    this._modalTitle.textContent = title;
    this._modalScore.textContent = scoreText;
    if (subText) {
      this._modalSub.textContent = subText;
      this._modalSub.style.display = 'block';
    } else {
      this._modalSub.style.display = 'none';
    }
    this._modal.classList.add('show');
  }

  hideModal() {
    this._modal.classList.remove('show');
  }

  _computeDefaultCamera() {
    const basePx = -3.24, basePy = 9.2, basePz = 10.77;
    if (innerWidth >= 750) return { px: basePx, py: basePy, pz: basePz, tx: 0, ty: .3, tz: 0 };
    const s = Math.min(1.6, 750 / Math.max(innerWidth, 400));
    return { px: basePx * s, py: basePy * s, pz: basePz * s, tx: 0, ty: .3, tz: 0 };
  }

  resetCamera() {
    const state = this._computeDefaultCamera();
    this._controls.maxDistance = Math.max(18, Math.hypot(state.px - state.tx, state.py - state.ty, state.pz - state.tz) * 1.5);
    this._tweenObj(this._camera.position, .6, new THREE.Vector3(state.px, state.py, state.pz));
    this._tweenObj(this._controls.target, .6, new THREE.Vector3(state.tx, state.ty, state.tz));
    return state;
  }

  getCameraState() {
    return {
      px: this._camera.position.x,
      py: this._camera.position.y,
      pz: this._camera.position.z,
      tx: this._controls.target.x,
      ty: this._controls.target.y,
      tz: this._controls.target.z,
    };
  }

  setCameraMode(active) {
    this._cameraMode = active;
    if (active) this._controls.enableRotate = true;
  }

  setCameraState(s) {
    if (!s) return;
    this._camera.position.set(s.px, s.py, s.pz);
    this._controls.target.set(s.tx, s.ty, s.tz);
    this._controls.update();
  }

  _setupTouchCamera() {
    const canvas = this._renderer.domElement;
    const setMode = (n) => {
      this._controls.enableRotate = this._cameraMode || n >= 2;
    };
    canvas.addEventListener('touchstart', (e) => { setMode(e.touches.length); }, { passive: true });
    canvas.addEventListener('touchend', (e) => { setMode(e.touches.length); }, { passive: true });
  }

  // ===== LOOP =====

  update(dt) {
    this._updateTweens(dt);
    this._updateParticles(dt);
    this._controls.update();
  }

  render() {
    if (!this._dirty && !this._activeTweens.length && !this._particles.length) return;
    this._dirty = false;
    this._renderer.render(this._scene, this._camera);
  }
}
