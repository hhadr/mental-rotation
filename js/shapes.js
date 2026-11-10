// Cube-snake generation, symmetry checks and complexity metrics.
// A snake is a self-avoiding path on the integer grid made of straight
// segments joined by 90° bends (Shepard–Metzler style).

const DIRS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// The 24 proper rotations of the cube = signed permutation matrices with det +1.
export const ROTATIONS = (() => {
  const perms = [[0, 1, 2, 1], [0, 2, 1, -1], [1, 0, 2, -1], [1, 2, 0, 1], [2, 0, 1, 1], [2, 1, 0, -1]];
  const out = [];
  for (const [p0, p1, p2, parity] of perms) {
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      if (parity * sx * sy * sz !== 1) continue;
      const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      m[0][p0] = sx; m[1][p1] = sy; m[2][p2] = sz;
      out.push(m);
    }
  }
  return out;
})();

export const applyM = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const mirrorVoxels = (vox) => vox.map(([x, y, z]) => [-x, y, z]);

function normKey(vox) {
  let mx = Infinity, my = Infinity, mz = Infinity;
  for (const [x, y, z] of vox) { mx = Math.min(mx, x); my = Math.min(my, y); mz = Math.min(mz, z); }
  return vox.map(([x, y, z]) => `${x - mx},${y - my},${z - mz}`).sort().join('|');
}

// Canonical key of a voxel set up to translation + proper rotation.
export function rotationKey(vox) {
  let best = null;
  for (const m of ROTATIONS) {
    const k = normKey(vox.map((v) => applyM(m, v)));
    if (best === null || k < best) best = k;
  }
  return best;
}

// Chiral = its mirror image cannot be obtained by any rotation. Only chiral shapes
// are usable, otherwise a "different" (mirror) trial would actually be "same".
export const isChiral = (vox) => rotationKey(vox) !== rotationKey(mirrorVoxels(vox));

// Key up to rotation AND reflection -> used to keep all shapes mutually unique.
export function shapeKey(vox) {
  const a = rotationKey(vox), b = rotationKey(mirrorVoxels(vox));
  return a < b ? a : b;
}

// Uniformly random composition of `steps` into `parts` arms, each >= minLen
// (stars and bars: pick parts-1 distinct cut points).
function segmentLengths(rng, steps, parts, minLen) {
  const extra = steps - parts * minLen;
  const slots = extra + parts - 1;
  const cuts = rng.shuffle([...Array(slots).keys()]).slice(0, parts - 1).sort((a, b) => a - b);
  const lens = [];
  let prev = -1;
  for (const c of [...cuts, slots]) { lens.push(minLen + (c - prev - 1)); prev = c; }
  return lens;
}

// No duplicate cells, and non-consecutive cubes must not share a face
// (otherwise the snake visually merges into a blob and becomes ambiguous).
function isValidPath(vox) {
  for (let i = 0; i < vox.length; i++) {
    for (let j = i + 2; j < vox.length; j++) {
      const d = Math.abs(vox[i][0] - vox[j][0]) + Math.abs(vox[i][1] - vox[j][1]) + Math.abs(vox[i][2] - vox[j][2]);
      if (d <= 1) return false;
    }
  }
  return true;
}

export function generateSnake(rng, nCubes, nBends, minSegmentLength = 2, maxTries = 50000) {
  const steps = nCubes - 1;
  const nSeg = nBends + 1;
  if (nSeg > steps) throw new Error(`Cannot make ${nBends} bends with only ${nCubes} cubes`);
  const minLen = steps >= minSegmentLength * nSeg ? minSegmentLength : 1;
  for (let t = 0; t < maxTries; t++) {
    const lengths = segmentLengths(rng, steps, nSeg, minLen);
    const dirs = [[1, 0, 0]];
    for (let i = 1; i < nSeg; i++) {
      const prev = dirs[i - 1];
      dirs.push(rng.pick(DIRS.filter((d) => dot(d, prev) === 0)));
    }
    const voxels = [[0, 0, 0]];
    const segIdx = [0];
    lengths.forEach((len, s) => {
      for (let k = 0; k < len; k++) {
        voxels.push(add(voxels[voxels.length - 1], dirs[s]));
        segIdx.push(s);
      }
    });
    if (!isValidPath(voxels) || !isChiral(voxels)) continue;
    return { voxels, segIdx, lengths, dirs, nCubes, nBends };
  }
  throw new Error(`Failed to generate a snake with ${nCubes} cubes and ${nBends} bends`);
}

// Complexity descriptors. Bend types (for every bend after the first one, comparing
// the segment before and after the pair of bends):
//   Z = zig-zag (coplanar, continues in the original direction)
//   U = U-turn  (coplanar, goes back)
//   R / L = out-of-plane bend, right/left-handed (torsion)
export function describeShape(shape) {
  const { dirs, lengths, voxels } = shape;
  const types = [];
  const handed = [];
  for (let j = 1; j < dirs.length - 1; j++) {
    const a = dirs[j - 1], b = dirs[j], c = dirs[j + 1];
    const d = dot(a, c);
    if (d === 1) types.push('Z');
    else if (d === -1) types.push('U');
    else {
      const h = dot(a, cross(b, c));
      types.push(h > 0 ? 'R' : 'L');
      handed.push(h);
    }
  }
  let handednessChanges = 0;
  for (let i = 1; i < handed.length; i++) if (handed[i] !== handed[i - 1]) handednessChanges++;

  const axes = new Set(dirs.map((d) => d.findIndex((x) => x !== 0)));
  const ext = [0, 1, 2].map((k) => {
    const vals = voxels.map((v) => v[k]);
    return Math.max(...vals) - Math.min(...vals) + 1;
  }).sort((p, q) => q - p);
  const c = [0, 1, 2].map((k) => voxels.reduce((s, v) => s + v[k], 0) / voxels.length);
  const rg = Math.sqrt(voxels.reduce((s, v) => s + (v[0] - c[0]) ** 2 + (v[1] - c[1]) ** 2 + (v[2] - c[2]) ** 2, 0) / voxels.length);
  const count = (ch) => types.filter((t) => t === ch).length;

  return {
    n_cubes: shape.nCubes,
    n_bends: shape.nBends,
    n_segments: dirs.length,
    n_nonplanar_bends: count('R') + count('L'),
    n_zigzag_bends: count('Z'),
    n_uturn_bends: count('U'),
    bend_sequence: types.join('') || '-',
    handedness_changes: handednessChanges,
    n_axes_used: axes.size,
    segment_lengths: lengths.join('-'),
    min_segment_length: Math.min(...lengths),
    max_segment_length: Math.max(...lengths),
    bbox: ext.join('x'),
    bbox_volume: ext[0] * ext[1] * ext[2],
    compactness: +(shape.nCubes / (ext[0] * ext[1] * ext[2])).toFixed(4),
    radius_of_gyration: +rg.toFixed(4),
  };
}
