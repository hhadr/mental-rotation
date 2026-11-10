import { CONFIG } from './config.js';
import { arrangeDesign } from './design.js';
import { STIMULI } from './stimuli.js';
import { PairRenderer } from './renderer.js';
import { toCSV } from './data.js';

const $ = (s) => document.querySelector(s);
const renderer = new PairRenderer($('#stim-export'), { pixelRatio: 1 });

const PROMPT = `You will see images, each showing two 3D objects made of cubes (left and right).
The right object is always rotated. Decide whether the right object is the SAME object as the left one
(only rotated) or a DIFFERENT object (a mirror image of the left one, which no rotation can make identical).
Answer with exactly one word: "same" or "different".
Round 1: after each answer you will be told whether it was correct and shown a solution image in which the
left object is rotated into the pose of the right one (cubes coloured by straight segment).
Round 2: no feedback.
`;

const toBlob = () => new Promise((r) => renderer.canvas.toBlob(r, 'image/png'));

$('#run').addEventListener('click', async () => {
  const btn = $('#run');
  btn.disabled = true;
  const orderSeed = +$('#order').value || 1;
  const group = +$('#group').value;
  const design = arrangeDesign(STIMULI, { orderSeed, group });
  const zip = new JSZip();
  const grid = $('#grid');
  grid.innerHTML = '';
  const manifest = [];
  const trials = [...design.train.map((t, i) => [t, 1, i]), ...design.test.map((t, i) => [t, 2, i])];
  renderer.resize();

  for (let k = 0; k < trials.length; k++) {
    const [t, round, i] = trials[k];
    $('#status').textContent = `Rendering ${k + 1} / ${trials.length}…`;
    const name = `r${round}_${String(i + 1).padStart(2, '0')}_${t.trial_id}`;
    renderer.setTrial(t);
    renderer.render();
    const blob = await toBlob();
    zip.file(`${name}.png`, blob);
    let solution = '';
    if (round === 1) {
      renderer.setTrial(t, { colored: true });
      renderer.poseLeftAsRight();
      renderer.render();
      zip.file(`${name}_solution.png`, await toBlob());
      solution = `${name}_solution.png`;
    }
    const fig = document.createElement('figure');
    fig.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt=""><figcaption>${name} · ${t.condition} · ${t.angle}° ${t.axis} · ${t.shape.metrics.n_cubes} cubes / ${t.shape.metrics.n_bends} bends</figcaption>`;
    grid.appendChild(fig);
    manifest.push({
      order: k + 1, round, trial_index: i + 1, image: `${name}.png`, solution_image: solution,
      trial_id: t.trial_id, phase: t.phase, is_repeated: t.phase === 'test_repeated' ? 1 : 0,
      shape_id: t.shape.id, complexity_slot: t.shape.slot, correct_answer: t.condition,
      angle: t.angle, axis: t.axis, view_prerot: t.view.prerot, view_tilt: t.view.tilt, view_yaw: t.view.yaw, min_cube_visible: t.min_cube_visible,
      train_trial_id: t.trainTrial?.trial_id ?? '', train_condition: t.trainTrial?.condition ?? '',
      ...t.shape.metrics, voxels: JSON.stringify(t.shape.voxels),
    });
  }
  zip.file('manifest.csv', '﻿' + toCSV(manifest));
  zip.file('prompt.txt', PROMPT);
  zip.file('design.json', JSON.stringify({ stimulusSeed: CONFIG.stimulusSeed, orderSeed, group, config: CONFIG }, null, 2));
  $('#status').textContent = 'Zipping…';
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stimuli_seed${CONFIG.stimulusSeed}_order${orderSeed}_group${group}.zip`;
  a.click();
  $('#status').textContent = `Done: ${trials.length} trials.`;
  btn.disabled = false;
});

