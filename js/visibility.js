// Measures how much of every cube is visible in a rendered view (pure JS, no WebGL).
// A small software z-buffer uses the same camera and pose as renderer.js. A view is
// only accepted if each cube keeps enough visible area to be seen and counted.
import { ROTATIONS, applyM, mirrorVoxels } from './shapes.js';

// Camera shared with renderer.js, so the check always matches what is drawn.
export const CAMERA_FOV = 28;
export const CAMERA_MARGIN = 1.04;
export const MIN_FIT_RADIUS = 3;

const DEG = Math.PI / 180;
const N = 160; // raster size in pixels
const TAN = Math.tan((CAMERA_FOV / 2) * DEG);
const depth = new Float64Array(N * N);
const owner = new Int16Array(N * N);

const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const rotX = (r) => [[1, 0, 0], [0, Math.cos(r), -Math.sin(r)], [0, Math.sin(r), Math.cos(r)]];
const rotY = (r) => [[Math.cos(r), 0, Math.sin(r)], [0, 1, 0], [-Math.sin(r), 0, Math.cos(r)]];
const rotZ = (r) => [[Math.cos(r), -Math.sin(r), 0], [Math.sin(r), Math.cos(r), 0], [0, 0, 1]];
const AXIS_ROT = { x: rotX, y: rotY, z: rotZ };

const centred = (vox) => {
  const c = [0, 1, 2].map((k) => vox.reduce((s, v) => s + v[k], 0) / vox.length);
  return vox.map((v) => [v[0] - c[0], v[1] - c[1], v[2] - c[2]]);
};

const fitRadius = (cent) => Math.max(...cent.map((v) => Math.hypot(v[0], v[1], v[2]))) + Math.sqrt(3) / 2;

export const cameraDistance = (radius, minFovRad = CAMERA_FOV * DEG) =>
  (Math.max(radius, MIN_FIT_RADIUS) / Math.sin(minFovRad / 2)) * CAMERA_MARGIN;

// Fraction of each cube's unobstructed projected area that remains visible.
// `cent` = centred cube positions, `R` = orientation, `dist` = camera distance.
function cubeFractions(cent, R, dist) {
  depth.fill(Infinity);
  owner.fill(-1);
  const alone = new Float64Array(cent.length);
  const seen = new Float64Array(cent.length);

  cent.forEach((p, id) => {
    const c = applyM(R, p);
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        const n = [R[0][axis] * sign, R[1][axis] * sign, R[2][axis] * sign];
        const fc = [c[0] + n[0] / 2, c[1] + n[1] / 2, c[2] + n[2] / 2];
        const facing = n[0] * -fc[0] + n[1] * -fc[1] + n[2] * (dist - fc[2]);
        if (facing <= 0) continue;

        // Face corners projected to pixels.
        const u = axis === 0 ? 1 : 0;
        const v = axis === 2 ? 1 : 2;
        const ua = [R[0][u] / 2, R[1][u] / 2, R[2][u] / 2];
        const va = [R[0][v] / 2, R[1][v] / 2, R[2][v] / 2];
        const quad = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => {
          const x = fc[0] + a * ua[0] + b * va[0];
          const y = fc[1] + a * ua[1] + b * va[1];
          const w = dist - (fc[2] + a * ua[2] + b * va[2]);
          return [((x / (w * TAN) + 1) / 2) * N, ((y / (w * TAN) + 1) / 2) * N];
        });

        const minX = Math.max(0, Math.floor(Math.min(...quad.map((q) => q[0]))));
        const maxX = Math.min(N - 1, Math.ceil(Math.max(...quad.map((q) => q[0]))));
        const minY = Math.max(0, Math.floor(Math.min(...quad.map((q) => q[1]))));
        const maxY = Math.min(N - 1, Math.ceil(Math.max(...quad.map((q) => q[1]))));
        const nDotF = n[0] * fc[0] + n[1] * fc[1] + n[2] * fc[2] - n[2] * dist;

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const sx = px + 0.5;
            const sy = py + 0.5;
            let pos = 0;
            let neg = 0;
            for (let e = 0; e < 4; e++) {
              const a = quad[e];
              const b = quad[(e + 1) % 4];
              const cr = (b[0] - a[0]) * (sy - a[1]) - (b[1] - a[1]) * (sx - a[0]);
              if (cr >= 0) pos++;
              if (cr <= 0) neg++;
            }
            if (pos !== 4 && neg !== 4) continue;
            alone[id]++;
            // Exact depth along the pixel's ray, from the face's plane equation.
            const rx = ((sx / N) * 2 - 1) * TAN;
            const ry = ((sy / N) * 2 - 1) * TAN;
            const w = nDotF / (n[0] * rx + n[1] * ry - n[2]);
            const i = py * N + px;
            if (w < depth[i]) { depth[i] = w; owner[i] = id; }
          }
        }
      }
    }
  });

  for (let i = 0; i < owner.length; i++) if (owner[i] >= 0) seen[owner[i]]++;
  return Array.from(seen, (s, i) => (alone[i] > 0 ? s / alone[i] : 0));
}

const baseMatrix = (view) => mul(rotX(view.tilt * DEG), rotY(view.yaw * DEG));

// Angle in degrees between the 3D poses of two views.
export function poseDifference(viewA, viewB) {
  const pose = (v) => mul(baseMatrix(v), ROTATIONS[v.prerot]);
  const A = pose(viewA);
  const B = pose(viewB);
  let trace = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) trace += A[i][j] * B[i][j];
  return Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2))) / DEG;
}

// Per-cube visible fractions for the images of a trial: left object, right object
// as the same shape, and right object as its mirror image.
export function trialVisibility(shape, view, axis, angle) {
  const vox = shape.voxels.map((v) => applyM(ROTATIONS[view.prerot], v));
  const left = centred(vox);
  const dist = cameraDistance(fitRadius(left));
  const Rb = baseMatrix(view);
  const Rr = mul(AXIS_ROT[axis](angle * DEG), Rb);
  return {
    left: cubeFractions(left, Rb, dist),
    rightSame: cubeFractions(left, Rr, dist),
    rightMirror: cubeFractions(centred(mirrorVoxels(vox)), Rr, dist),
  };
}

// Same test as minVisibility() >= threshold, but stops at the first failing image.
export function isClearView(shape, view, axis, angle, threshold) {
  const vox = shape.voxels.map((v) => applyM(ROTATIONS[view.prerot], v));
  const left = centred(vox);
  const dist = cameraDistance(fitRadius(left));
  const Rb = baseMatrix(view);
  if (Math.min(...cubeFractions(left, Rb, dist)) < threshold) return false;
  const Rr = mul(AXIS_ROT[axis](angle * DEG), Rb);
  if (Math.min(...cubeFractions(left, Rr, dist)) < threshold) return false;
  return Math.min(...cubeFractions(centred(mirrorVoxels(vox)), Rr, dist)) >= threshold;
}

// Worst-case cube visibility. All three images are checked because the
// counterbalancing group can swap "same" and "different" for any trial.
export function minVisibility(shape, view, axis, angle) {
  const v = trialVisibility(shape, view, axis, angle);
  return Math.min(...v.left, ...v.rightSame, ...v.rightMirror);
}
