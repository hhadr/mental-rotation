// Stimulus set and trial list (pure JS, no DOM / three.js).
// buildStimuli()  : slow; run once by tools/build-stimuli.mjs, result is js/stimuli.js
// arrangeDesign() : fast; applies each participant's counterbalancing and trial order
import { makeRng } from './rng.js';
import { generateSnake, shapeKey, describeShape } from './shapes.js';
import { minVisibility, isClearView, poseDifference } from './visibility.js';

const round1 = (x) => Math.round(x * 10) / 10;

function maxRun(trials) {
  let best = 1, cur = 1;
  for (let i = 1; i < trials.length; i++) {
    cur = trials[i].condition === trials[i - 1].condition ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

// Shuffle with "no more than 3 identical answers in a row".
function shuffleConstrained(rng, trials, maxSame = 3) {
  let best = rng.shuffle(trials);
  for (let i = 0; i < 2000 && maxRun(best) > maxSame; i++) best = rng.shuffle(trials);
  return best;
}

// Settings that determine the stimuli; js/stimuli.js must be rebuilt if they change.
export const stimulusConfigKey = (c) => JSON.stringify([
  c.stimulusSeed, c.complexitySlots, c.minSegmentLength, c.angles, c.axes, c.tiltRange,
  c.repeatNewView, c.minCubeVisibility, c.viewCandidates, c.minRepeatPoseDiff, c.practiceTrials,
  c.balanceRestarts, c.balanceSteps,
]);

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function buildStimuli(config) {
  const rng = makeRng(config.stimulusSeed);
  const seen = new Set();
  const shapes = [];

  const randomView = () => ({
    prerot: rng.int(24),
    tilt: round1(rng.range(config.tiltRange[0], config.tiltRange[1])),
    yaw: round1(rng.range(0, 360)),
  });

  // A shape is usable only if every angle/axis it may be assigned has a clear view.
  const isViewable = (s) => config.angles.every((angle) => config.axes.every((axis) => {
    for (let i = 0; i < config.viewCandidates; i++) {
      if (isClearView(s, randomView(), axis, angle, config.minCubeVisibility)) return true;
    }
    return false;
  }));

  const newShape = (nCubes, nBends, slot, nonplanar) => {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const s = generateSnake(rng, nCubes, nBends, config.minSegmentLength);
      if (nonplanar !== undefined && describeShape(s).n_nonplanar_bends !== nonplanar) continue;
      const key = shapeKey(s.voxels);
      if (seen.has(key)) continue;
      seen.add(key); // also skips shapes already rejected below
      if (!isViewable(s)) continue;
      s.id = 'S' + String(shapes.length + 1).padStart(2, '0');
      s.slot = slot;
      s.metrics = describeShape(s);
      shapes.push(s);
      return s;
    }
    throw new Error(`Not enough distinct viewable shapes with ${nCubes} cubes / ${nBends} bends`);
  };

  // Assigns angles and axes so they are as balanced as possible across complexity.
  // Angles stay exactly balanced within each phase x condition, axes within each block x condition;
  // a local search then swaps values inside those groups to even out the crossed tables below.
  const assignAnglesAndAxes = (trials) => {
    const groupBy = (keyOf) => {
      const groups = new Map();
      for (const t of trials) groups.set(keyOf(t), [...(groups.get(keyOf(t)) ?? []), t]);
      return [...groups.values()];
    };
    const angleGroups = groupBy((t) => `${t.phase}|${t.condition}`);
    const axisGroups = groupBy((t) => `${t.block}|${t.condition}`);
    const deal = (group, field, values) => {
      let out = [];
      while (out.length < group.length) out = out.concat(rng.shuffle(values));
      rng.shuffle(out.slice(0, group.length)).forEach((v, i) => { group[i][field] = v; });
    };
    const cubes = (t) => t.shape.metrics.n_cubes;
    const bends = (t) => t.shape.metrics.n_bends;
    const meanAngle = config.angles.reduce((s, a) => s + a, 0) / config.angles.length;
    const tables = [
      (t) => [t.block, bends(t), t.angle],
      (t) => [t.shape.slot, t.angle],
      (t) => [cubes(t), t.angle],
      (t) => [t.phase, t.axis],
      (t) => [t.block, t.angle, t.axis],
      (t) => [bends(t), t.angle, t.axis],
      (t) => [t.block, bends(t), t.axis],
      (t) => [t.block, cubes(t), t.axis],
      (t) => [cubes(t), t.axis],
    ];
    // Sum of squared cell counts: smallest when every table is as even as possible.
    const cost = () => {
      let total = 0;
      for (const keys of tables) {
        const counts = new Map();
        for (const t of trials) {
          const k = keys(t).join('|');
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        for (const c of counts.values()) total += c * c;
      }
      // Every cube count should have about the same mean angle.
      const offsets = new Map();
      for (const t of trials) offsets.set(cubes(t), (offsets.get(cubes(t)) ?? 0) + t.angle - meanAngle);
      for (const offset of offsets.values()) total += (offset / 30) ** 2;
      // A repeated shape must come back at a different angle.
      for (const t of trials) if (t.trainTrial && t.angle === t.trainTrial.angle) total += 1000;
      return total;
    };
    const swap = (a, b, field) => { [a[field], b[field]] = [b[field], a[field]]; };

    let best = null;
    let bestCost = Infinity;
    for (let restart = 0; restart < config.balanceRestarts; restart++) {
      angleGroups.forEach((g) => deal(g, 'angle', config.angles));
      axisGroups.forEach((g) => deal(g, 'axis', config.axes));
      let current = cost();
      for (let step = 0; step < config.balanceSteps; step++) {
        const field = rng.int(2) ? 'angle' : 'axis';
        const groups = field === 'angle' ? angleGroups : axisGroups;
        const g = groups[rng.int(groups.length)];
        const a = g[rng.int(g.length)];
        const b = g[rng.int(g.length)];
        if (a === b || a[field] === b[field]) continue;
        swap(a, b, field);
        const next = cost();
        if (next <= current) current = next; else swap(a, b, field);
      }
      if (current < bestCost) {
        bestCost = current;
        best = trials.map((t) => [t.angle, t.axis]);
      }
    }
    trials.forEach((t, i) => { [t.angle, t.axis] = best[i]; });
  };

  const slots = config.complexitySlots.map(([n, b, np], si) => [0, 1, 2].map(() => newShape(n, b, si, np)));
  const nSlots = slots.length;

  // ----- Round 1 (training): per slot one SAME and one DIFFERENT trial ----------
  const train = [];
  const repeatedFromSame = new Set(rng.shuffle([...Array(nSlots).keys()]).slice(0, Math.floor(nSlots / 2)));
  const repeated = []; // {shape, trainTrial}
  const fresh = [];
  slots.forEach((trio, si) => {
    const [a, b] = rng.shuffle([trio[0], trio[1]]);
    const tSame = { block: 'train', phase: 'train', shape: a, condition: 'same' };
    const tDiff = { block: 'train', phase: 'train', shape: b, condition: 'different' };
    train.push(tSame, tDiff);
    // The repeated shape is the "same" trial in half the slots and the "different" one in the other half.
    repeated.push(repeatedFromSame.has(si) ? { shape: a, trainTrial: tSame } : { shape: b, trainTrial: tDiff });
    fresh.push(trio[2]);
  });

  // ----- Round 2 (test): 10 repeated + 10 new ---------------------------------
  // Repeated: ~half keep their round-1 answer, ~half switch, overall 50 % same.
  const repSame = rng.shuffle(repeated.filter((r) => r.trainTrial.condition === 'same'));
  const repDiff = rng.shuffle(repeated.filter((r) => r.trainTrial.condition === 'different'));
  const keepS = Math.ceil(repSame.length / 2), keepD = Math.ceil(repDiff.length / 2);
  const mkRep = (r, condition) => ({
    block: 'test', phase: 'test_repeated', shape: r.shape, condition, trainTrial: r.trainTrial,
  });
  const repTrials = [
    ...repSame.map((r, i) => mkRep(r, i < keepS ? 'same' : 'different')),
    ...repDiff.map((r, i) => mkRep(r, i < keepD ? 'different' : 'same')),
  ];
  const newTrials = rng.shuffle(fresh).map((s, i) => ({
    block: 'test', phase: 'test_new', shape: s,
    condition: i < Math.ceil(fresh.length / 2) ? 'same' : 'different',
  }));
  const test = [...repTrials, ...newTrials];
  if (config.repeatNewView) {
    assignAnglesAndAxes([...train, ...test]);
  } else {
    assignAnglesAndAxes([...train, ...newTrials]);
    for (const t of repTrials) { t.angle = t.trainTrial.angle; t.axis = t.trainTrial.axis; }
  }

  // ----- Demo shape for the instructions (not used in any trial) ---------------
  const demoShape = newShape(9, 3, -1);
  shapes.pop();
  demoShape.id = 'DEMO';
  const demo = [
    { block: 'demo', phase: 'demo', shape: demoShape, condition: 'same', angle: 90, axis: 'y' },
    { block: 'demo', phase: 'demo', shape: demoShape, condition: 'different', angle: 60, axis: 'z' },
  ];

  train.forEach((t, i) => { t.trial_id = `train_${String(i + 1).padStart(2, '0')}`; });
  test.forEach((t, i) => { t.trial_id = `test_${String(i + 1).padStart(2, '0')}`; });
  demo.forEach((t, i) => { t.trial_id = `demo_${i + 1}`; });

  // ----- Viewpoints: the clearest of many random candidates --------------------
  const chooseView = (t) => {
    const prior = config.repeatNewView ? t.trainTrial?.view : null;
    let best = null;
    let bestScore = -1;
    // Keeps searching past viewCandidates if nothing clear has been found yet.
    for (let i = 0; i < config.viewCandidates || (bestScore < config.minCubeVisibility && i < config.viewCandidates * 50); i++) {
      const v = randomView();
      if (prior && poseDifference(prior, v) < config.minRepeatPoseDiff) continue;
      const score = minVisibility(t.shape, v, t.axis, t.angle);
      if (score > bestScore) { best = v; bestScore = score; }
    }
    if (bestScore < config.minCubeVisibility) throw new Error(`No clear view for ${t.trial_id}`);
    t.view = best;
    t.min_cube_visible = Math.round(bestScore * 1000) / 1000;
  };
  for (const t of [...train, ...test, ...demo]) {
    if (t.trainTrial && !config.repeatNewView) {
      t.view = { ...t.trainTrial.view };
      t.min_cube_visible = t.trainTrial.min_cube_visible;
    } else {
      chooseView(t);
    }
  }

  // ----- Practice trials -------------------------------------------------------
  // Generated last so that the random stream of the experimental stimuli is unaffected.
  const practice = config.practiceTrials.map((p, i) => {
    const shape = newShape(p.cubes, p.bends, -1);
    shapes.pop();
    shape.id = `P${i + 1}`;
    const t = {
      block: 'practice', phase: 'practice', trial_id: `practice_${i + 1}`,
      shape, condition: p.condition, angle: p.angle, axis: p.axis,
    };
    chooseView(t);
    return t;
  });

  // ----- Serialisable output ---------------------------------------------------
  const plain = (t) => ({
    trial_id: t.trial_id, block: t.block, phase: t.phase, shapeId: t.shape.id, condition: t.condition,
    angle: t.angle, axis: t.axis, view: t.view, min_cube_visible: t.min_cube_visible,
    ...(t.trainTrial ? { trainTrialId: t.trainTrial.trial_id } : {}),
  });
  const body = {
    shapes: [...shapes, demoShape, ...practice.map((t) => t.shape)],
    train: train.map(plain),
    test: test.map(plain),
    demo: demo.map(plain),
    practice: practice.map(plain),
  };
  return { configKey: stimulusConfigKey(config), hash: fnv1a(JSON.stringify(body)), ...body };
}

// Applies one participant's counterbalancing group and trial order.
export function arrangeDesign(stimuli, { orderSeed = 1, group = 0 } = {}) {
  const byShape = new Map(stimuli.shapes.map((s) => [s.id, s]));
  const hydrate = (t) => ({ ...t, shape: byShape.get(t.shapeId) });
  const train = stimuli.train.map(hydrate);
  const test = stimuli.test.map(hydrate);
  const demo = stimuli.demo.map(hydrate);
  const practice = stimuli.practice.map(hydrate);
  const trainById = new Map(train.map((t) => [t.trial_id, t]));
  for (const t of test) if (t.trainTrialId) t.trainTrial = trainById.get(t.trainTrialId);
  if (group === 1) {
    for (const t of [...train, ...test]) t.condition = t.condition === 'same' ? 'different' : 'same';
  }
  const orng = makeRng(orderSeed);
  return {
    train: shuffleConstrained(orng, train),
    test: shuffleConstrained(orng, test),
    demo, practice, group, orderSeed,
  };
}
