// Renders a left/right pair of cube snakes in one WebGL canvas (two viewports).
import * as THREE from 'three';
import { ROTATIONS, applyM, mirrorVoxels } from './shapes.js';
import { CAMERA_FOV, MIN_FIT_RADIUS, cameraDistance } from './visibility.js';

const NEUTRAL = '#c9ccd3';
// One colour per straight segment (shown only in feedback / solution animation).
export const PALETTE = ['#d62728', '#1f77b4', '#2ca02c', '#ff7f0e', '#9467bd', '#17becf', '#e377c2', '#8c564b'];

const DEG = Math.PI / 180;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

export const baseQuat = (view) => new THREE.Quaternion().setFromEuler(new THREE.Euler(view.tilt * DEG, view.yaw * DEG, 0, 'XYZ'));
export const rotQuat = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(AXES[axis], angle * DEG);

export class PairRenderer {
  constructor(canvas, { pixelRatio } = {}) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.gl.setPixelRatio(pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2));
    this.gl.setClearColor(0xffffff, 1);
    this.gl.setScissorTest(true);
    this.scenes = [this.makeScene(), this.makeScene()];
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 500);
    this.boxGeom = new THREE.BoxGeometry(1, 1, 1);
    this.edgeGeom = new THREE.EdgesGeometry(this.boxGeom);
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x1c1c1c });
    this.mats = new Map();
    this.state = null;
    this.raf = null;
    this.radius = 3;
    this.resize();
  }

  makeScene() {
    const s = new THREE.Scene();
    s.add(new THREE.AmbientLight(0xffffff, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 8);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-6, -2, 4);
    s.add(key, fill);
    return s;
  }

  material(color) {
    if (!this.mats.has(color)) {
      this.mats.set(color, new THREE.MeshLambertMaterial({
        color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      }));
    }
    return this.mats.get(color);
  }

  // Returns {outer, inner}: outer carries the orientation, inner carries a
  // mirror scale (used by the animation), cubes are centred on the centroid.
  buildShape(shape, view, { mirror = false, colored = false } = {}) {
    let vox = shape.voxels.map((v) => applyM(ROTATIONS[view.prerot], v));
    if (mirror) vox = mirrorVoxels(vox);
    const c = [0, 1, 2].map((k) => vox.reduce((s, v) => s + v[k], 0) / vox.length);
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    outer.add(inner);
    vox.forEach((v, i) => {
      const color = colored ? PALETTE[shape.segIdx[i] % PALETTE.length] : NEUTRAL;
      const mesh = new THREE.Mesh(this.boxGeom, this.material(color));
      mesh.position.set(v[0] - c[0], v[1] - c[1], v[2] - c[2]);
      const edges = new THREE.LineSegments(this.edgeGeom, this.lineMat);
      edges.position.copy(mesh.position);
      inner.add(mesh, edges);
    });
    const radius = Math.max(...vox.map((v) => Math.hypot(v[0] - c[0], v[1] - c[1], v[2] - c[2]))) + Math.sqrt(3) / 2;
    return { outer, inner, radius };
  }

  setTrial(trial, { colored = false } = {}) {
    this.stop();
    this.clear();
    const qb = baseQuat(trial.view);
    const qr = rotQuat(trial.axis, trial.angle).multiply(qb);
    const L = this.buildShape(trial.shape, trial.view, { colored });
    const R = this.buildShape(trial.shape, trial.view, { colored, mirror: trial.condition === 'different' });
    L.outer.quaternion.copy(qb);
    R.outer.quaternion.copy(qr);
    this.scenes[0].add(L.outer);
    this.scenes[1].add(R.outer);
    this.radius = Math.max(L.radius, MIN_FIT_RADIUS);
    this.state = { trial, qb, qr, L, R };
  }

  clear() {
    if (!this.state) return;
    this.scenes[0].remove(this.state.L.outer);
    this.scenes[1].remove(this.state.R.outer);
    this.state = null;
  }

  // Hide both objects (e.g. during fixation) without rebuilding.
  blank() {
    this.stop();
    this.clear();
    this.render();
  }

  resize() {
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 400;
    this.gl.setSize(w, h, false);
    this.w = w;
    this.h = h;
  }

  render() {
    const { w, h } = this;
    const hw = w / 2;
    const aspect = hw / h;
    const fovV = this.camera.fov * DEG;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const dist = cameraDistance(this.radius, Math.min(fovV, fovH));
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    for (let i = 0; i < 2; i++) {
      this.gl.setViewport(i * hw, 0, hw, h);
      this.gl.setScissor(i * hw, 0, hw, h);
      this.gl.render(this.scenes[i], this.camera);
    }
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._resolve) { this._resolve(false); this._resolve = null; }
  }

  // Pose the left object like the right one (rotation only, no mirror).
  // Used for the static "solution" image in the VLM export.
  poseLeftAsRight() {
    const { L, qr } = this.state;
    L.outer.quaternion.copy(qr);
    L.inner.scale.set(1, 1, 1);
  }

  // Solution animation: left object rotates into the right object's orientation;
  // for "different" trials it then mirror-flips, showing it is the mirror image.
  // onPhase('rotate' | 'mirror' | 'done'). Resolves true when finished.
  playSolution({ delayMs = 500, rotateMs = 2200, holdMs = 700, mirrorMs = 1400, onPhase = () => {} } = {}) {
    this.stop();
    const { L, qb, qr, trial } = this.state;
    const isDiff = trial.condition === 'different';
    L.outer.quaternion.copy(qb);
    L.inner.scale.set(1, 1, 1);
    this.render();
    const total = delayMs + rotateMs + (isDiff ? holdMs + mirrorMs : 0);
    let phase = null;
    const setPhase = (p) => { if (p !== phase) { phase = p; onPhase(p); } };
    return new Promise((resolve) => {
      this._resolve = resolve;
      const t0 = performance.now();
      const step = (now) => {
        const t = now - t0;
        const a = ease((t - delayMs) / rotateMs);
        L.outer.quaternion.slerpQuaternions(qb, qr, a);
        if (t >= delayMs) setPhase('rotate');
        if (isDiff) {
          const b = ease((t - delayMs - rotateMs - holdMs) / mirrorMs);
          L.inner.scale.x = 1 - 2 * b;
          if (t >= delayMs + rotateMs + holdMs) setPhase('mirror');
        }
        this.render();
        if (t < total) {
          this.raf = requestAnimationFrame(step);
        } else {
          this.raf = null;
          this._resolve = null;
          setPhase('done');
          resolve(true);
        }
      };
      this.raf = requestAnimationFrame(step);
    });
  }
}
