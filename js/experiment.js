import { CONFIG } from './config.js';
import { arrangeDesign, stimulusConfigKey } from './design.js';
import { STIMULI } from './stimuli.js';
import { PairRenderer } from './renderer.js';
import { STRINGS } from './i18n.js';
import { toCSV, downloadText, backupLocal, saveData } from './data.js';
import { randomSeed } from './rng.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const lang = STRINGS[params.get('lang')] ? params.get('lang') : CONFIG.defaultLang;
const T = STRINGS[lang];
document.documentElement.lang = lang;
document.title = T.title;

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('');
const participantId = (params.get('pid') || params.get('PROLIFIC_PID') || randomId()).replace(/[^\w-]/g, '').slice(0, 64);
const orderSeed = randomSeed();
const group = CONFIG.counterbalanceConditions
  ? (['0', '1'].includes(params.get('group')) ? +params.get('group') : randomSeed() % 2)
  : 0;
if (STIMULI.configKey !== stimulusConfigKey(CONFIG)) {
  document.body.textContent = 'js/stimuli.js is out of date: run node tools/build-stimuli.mjs';
  throw new Error('Stale stimuli');
}
const design = arrangeDesign(STIMULI, { orderSeed, group });

const $ = (s) => document.querySelector(s);
const content = $('#content');
const stage = $('#stage');
const canvas = $('#stim');
const fixation = $('#fixation');
const respBar = $('#response-bar');
const feedback = $('#feedback');
const progressEl = $('#progress');
const demoBar = $('#demo-bar');

const session = {
  participant_id: participantId,
  experiment: CONFIG.experimentName,
  version: CONFIG.version,
  stimulus_seed: CONFIG.stimulusSeed,
  stimulus_hash: STIMULI.hash,
  order_seed: orderSeed,
  group,
  lang,
  started_at: new Date().toISOString(),
  user_agent: navigator.userAgent,
  screen_w: screen.width,
  screen_h: screen.height,
  window_w: innerWidth,
  window_h: innerHeight,
  device_pixel_ratio: devicePixelRatio,
  touch: 'ontouchstart' in window ? 1 : 0,
};
const rows = [];
const trainResults = new Map(); // shape id -> {correct, rt_ms}
let renderer;
let running = false;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(performance.now())));
const blur = () => document.activeElement?.blur?.();

function showContent(html) {
  content.innerHTML = html;
  content.hidden = false;
  window.scrollTo(0, 0);
}

function showStage(on) {
  stage.hidden = !on;
  if (on) { renderer.resize(); renderer.render(); }
}

function setCanvasVisible(on) {
  canvas.style.visibility = on ? 'visible' : 'hidden';
  fixation.hidden = on;
}

// Resolves when `button` is clicked or space is pressed (and button is enabled).
function waitContinue(button, { space = true } = {}) {
  return new Promise((resolve) => {
    const done = () => {
      if (button.disabled) return;
      document.removeEventListener('keydown', onKey);
      button.removeEventListener('click', done);
      blur();
      resolve();
    };
    const onKey = (e) => {
      if (space && e.code === 'Space' && !e.repeat) { e.preventDefault(); done(); }
    };
    document.addEventListener('keydown', onKey);
    button.addEventListener('click', done);
  });
}

function setResponseEnabled(on) {
  respBar.querySelectorAll('button').forEach((b) => { b.disabled = !on; });
}

function waitResponse(t0, timeoutMs) {
  return new Promise((resolve) => {
    let timer;
    const finish = (response, method, t) => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      respBar.querySelectorAll('button').forEach((b) => b.removeEventListener('pointerdown', onBtn));
      resolve({ response, method, rt: response ? t - t0 : null });
    };
    const onKey = (e) => {
      if (e.repeat) return;
      // event.timeStamp shares performance.now()'s time origin -> more precise RT
      const t = e.timeStamp > 0 ? e.timeStamp : performance.now();
      if (e.code === CONFIG.keys.same) { e.preventDefault(); finish('same', 'key', t); }
      else if (e.code === CONFIG.keys.different) { e.preventDefault(); finish('different', 'key', t); }
    };
    const onBtn = (e) => {
      const t = e.timeStamp > 0 ? e.timeStamp : performance.now();
      finish(e.currentTarget.dataset.resp, 'button', t);
    };
    document.addEventListener('keydown', onKey);
    respBar.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', onBtn));
    timer = setTimeout(() => finish(null, 'timeout', performance.now()), timeoutMs);
  });
}

const animOpts = (onPhase) => ({
  delayMs: CONFIG.animDelayMs,
  rotateMs: CONFIG.animRotateMs,
  onPhase,
});

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
async function screenWelcome() {
  const small = Math.min(innerWidth, screen.width) < 700;
  showContent(`
    <div class="lang">${T.langSwitch}</div>
    ${T.welcome()}
    ${small ? `<p class="warn">${T.smallScreen}</p>` : ''}
    <label class="check"><input type="checkbox" id="consent"> ${T.consentCheck}</label>
    <div class="actions"><button id="go" disabled>${T.continue}</button></div>`);
  const cb = $('#consent'), go = $('#go');
  cb.addEventListener('change', () => { go.disabled = !cb.checked; });
  await waitContinue(go, { space: false });
}

function select(id, label, options) {
  return `<label class="field"><span>${label}</span><select id="${id}" required>
    <option value="">${T.choose}</option>
    ${Object.entries(options).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
  </select></label>`;
}

async function screenDemographics() {
  showContent(`
    <h1>${T.demoHeading}</h1>
    <form id="demo" novalidate>
      <label class="field"><span>${T.age}</span><input type="number" id="age" min="10" max="99" required></label>
      ${select('gender', T.gender, T.genders)}
      ${select('hand', T.hand, T.hands)}
      ${select('prior', T.prior, T.yesNo)}
      <p class="error" id="err" hidden>${T.required}</p>
      <div class="actions"><button type="submit">${T.continue}</button></div>
    </form>`);
  await new Promise((resolve) => {
    $('#demo').addEventListener('submit', (e) => {
      e.preventDefault();
      const age = +$('#age').value;
      const vals = { gender: $('#gender').value, hand: $('#hand').value, prior: $('#prior').value };
      if (!(age >= 10 && age <= 99) || Object.values(vals).some((v) => !v)) { $('#err').hidden = false; return; }
      Object.assign(session, {
        age, gender: vals.gender, handedness: vals.hand, prior_mr_experience: vals.prior,
      });
      resolve();
    });
  });
}

async function screenInstructions() {
  showContent(T.instructions(CONFIG.keyLabels, design.practice.length));
  showStage(true);
  respBar.hidden = true;
  feedback.innerHTML = '';
  progressEl.textContent = '';
  setCanvasVisible(true);
  demoBar.hidden = false;
  demoBar.innerHTML = `
    <div class="demo-buttons">
      <button class="secondary" data-demo="0">${T.demoSame}</button>
      <button class="secondary" data-demo="1">${T.demoDiff}</button>
    </div>
    <div class="fb-explain" id="demo-explain"></div>
    <div class="fb-phase" id="demo-phase"></div>
    <div class="actions"><button id="start">${T.startPractice}</button></div>`;

  const play = (i) => {
    const t = design.demo[i];
    demoBar.querySelectorAll('[data-demo]').forEach((b) => b.classList.toggle('active', +b.dataset.demo === i));
    const ax = T.axisNames[t.axis];
    $('#demo-explain').innerHTML = t.condition === 'same' ? T.explainSame(t.angle, ax) : T.explainDiff(t.angle, ax);
    renderer.setTrial(t, { colored: true });
    renderer.render();
    renderer.playSolution(animOpts((p) => { $('#demo-phase').textContent = T.phase[p]; }));
  };
  demoBar.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => { blur(); play(+b.dataset.demo); }));
  play(0);

  await waitContinue($('#start'), { space: false });
  renderer.stop();
  demoBar.hidden = true;
  demoBar.innerHTML = '';
}

async function screenPracticeDone() {
  showStage(false);
  showContent(`${T.practiceDone()}<div class="actions"><button id="go">${T.startTraining}</button><span class="hint">${T.spaceHint}</span></div>`);
  await wait(1500); // avoid skipping this screen by accident
  await waitContinue($('#go'));
}

async function screenBreak() {
  showStage(false);
  showContent(`${T.breakScreen()}<div class="actions"><button id="go">${T.startTest}</button><span class="hint">${T.spaceHint}</span></div>`);
  await wait(1500); // avoid skipping the break by accident
  await waitContinue($('#go'));
}

async function screenPost() {
  showStage(false);
  const scale = [1, 2, 3, 4, 5].map((v) => `<label class="radio"><input type="radio" name="diff" value="${v}"> ${v}</label>`).join('');
  showContent(`
    <h1>${T.postHeading}</h1>
    <form id="post" novalidate>
      ${select('noticed', T.noticed, T.yesNo)}
      <div class="field"><span>${T.difficulty}</span><div class="scale">${scale}</div></div>
      <label class="field"><span>${T.strategy}</span><textarea id="strategy" rows="3" maxlength="1000"></textarea></label>
      <p class="error" id="err" hidden>${T.required}</p>
      <div class="actions"><button type="submit">${T.finish}</button></div>
    </form>`);
  await new Promise((resolve) => {
    $('#post').addEventListener('submit', (e) => {
      e.preventDefault();
      const noticed = $('#noticed').value;
      const diff = document.querySelector('input[name="diff"]:checked')?.value;
      if (!noticed || !diff) { $('#err').hidden = false; return; }
      Object.assign(session, {
        noticed_repeats: noticed,
        difficulty_rating: +diff,
        strategy: $('#strategy').value.trim().replace(/\s+/g, ' '),
      });
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------
async function showFeedback(trial, res, correct) {
  respBar.hidden = true;
  const t0 = performance.now();
  const status = res.response === null ? ['timeout', T.timeout] : correct ? ['ok', T.correct] : ['bad', T.incorrect];
  const ax = T.axisNames[trial.axis];
  feedback.innerHTML = `
    <div class="fb-status ${status[0]}">${status[1]}</div>
    <div class="fb-explain">${trial.condition === 'same' ? T.explainSame(trial.angle, ax) : T.explainDiff(trial.angle, ax)}</div>
    <div class="fb-phase" id="fb-phase"></div>
    <div class="actions">
      <button id="replay" class="secondary" disabled>${T.replay}</button>
      <button id="next" disabled>${T.next}</button>
      <span class="hint">${T.spaceHint}</span>
    </div>`;
  const phaseEl = $('#fb-phase'), replay = $('#replay'), next = $('#next');
  let replays = 0;
  renderer.setTrial(trial, { colored: true });
  renderer.render();
  setCanvasVisible(true);
  const play = () => renderer.playSolution(animOpts((p) => { phaseEl.textContent = T.phase[p]; }));
  replay.addEventListener('click', () => { replays++; blur(); play(); });
  await play();
  replay.disabled = false;
  next.disabled = false;
  await waitContinue(next);
  renderer.stop();
  feedback.innerHTML = '';
  respBar.hidden = false;
  return { feedback_ms: Math.round(performance.now() - t0), feedback_replays: replays };
}

async function runTrial(trial, index, total, round, globalIndex) {
  const isPractice = trial.block === 'practice';
  progressEl.textContent = isPractice ? T.practiceProgress(index + 1, total) : T.progress(round, index + 1, total);
  setResponseEnabled(false);
  renderer.blank();
  setCanvasVisible(false);
  await wait(CONFIG.fixationMs);

  renderer.setTrial(trial);
  renderer.render();
  setCanvasVisible(true);
  const onset = await nextFrame();
  setResponseEnabled(true);
  const res = await waitResponse(onset, CONFIG.trialTimeoutMs);
  setResponseEnabled(false);
  const correct = res.response === trial.condition ? 1 : 0;

  let fb = {};
  if (trial.block === 'train') trainResults.set(trial.shape.id, { correct, rt_ms: res.rt });
  if (trial.block !== 'test') fb = await showFeedback(trial, res, correct);
  if (isPractice) return; // practice trials are not recorded

  const tt = trial.trainTrial;
  const train = tt ? trainResults.get(trial.shape.id) : null;
  rows.push({
    block: trial.block,
    round,
    phase: trial.phase,
    is_repeated: trial.phase === 'test_repeated' ? 1 : 0,
    trial_index: index + 1,
    global_index: globalIndex,
    trial_id: trial.trial_id,
    shape_id: trial.shape.id,
    complexity_slot: trial.shape.slot,
    condition: trial.condition,
    angle: trial.angle,
    axis: trial.axis,
    view_prerot: trial.view.prerot,
    view_tilt: trial.view.tilt,
    view_yaw: trial.view.yaw,
    min_cube_visible: trial.min_cube_visible,
    response: res.response ?? '',
    correct,
    rt_ms: res.rt === null ? '' : Math.round(res.rt * 10) / 10,
    timeout: res.response === null ? 1 : 0,
    response_method: res.method,
    feedback_ms: fb.feedback_ms ?? '',
    feedback_replays: fb.feedback_replays ?? '',
    train_trial_id: tt?.trial_id ?? '',
    train_condition: tt?.condition ?? '',
    train_angle: tt?.angle ?? '',
    train_axis: tt?.axis ?? '',
    train_correct: train?.correct ?? '',
    train_rt_ms: train?.rt_ms == null ? '' : Math.round(train.rt_ms * 10) / 10,
    same_condition_as_train: tt ? (tt.condition === trial.condition ? 1 : 0) : '',
    ...trial.shape.metrics,
    voxels: JSON.stringify(trial.shape.voxels),
    timestamp: new Date().toISOString(),
  });
  backupLocal(`mr_partial_${participantId}`, toCSV(rows));

  if (trial.block === 'test') {
    renderer.blank();
    setCanvasVisible(false);
    fixation.hidden = true;
    await wait(CONFIG.itiMs);
  }
}

async function runBlock(trials, round, offset) {
  content.hidden = true;
  showStage(true);
  feedback.innerHTML = '';
  respBar.hidden = false;
  for (let i = 0; i < trials.length; i++) {
    await runTrial(trials[i], i, trials.length, round, offset + i + 1);
  }
}

// ---------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------
async function finish() {
  session.finished_at = new Date().toISOString();
  session.duration_s = Math.round((Date.parse(session.finished_at) - Date.parse(session.started_at)) / 1000);
  const allRows = rows.map((r) => ({ ...session, ...r }));
  const csv = toCSV(allRows);
  const stamp = session.started_at.replace(/[:.]/g, '-');
  const filename = `${CONFIG.experimentName}_${participantId}_${stamp}.csv`;
  backupLocal(`mr_final_${participantId}`, csv);

  showStage(false);
  showContent(T.saving);
  let html;
  let primaryDownload = false;
  try {
    await saveData(CONFIG, filename, csv, allRows);
    html = T.saved;
  } catch (e) {
    console.warn('Data upload failed:', e);
    html = e.message === 'no-backend' ? T.downloadOnly : T.saveFailed;
    primaryDownload = true;
  }
  running = false;
  showContent(`${html}
    <div class="actions"><button id="dl" class="${primaryDownload ? '' : 'secondary'}">${primaryDownload ? T.download : T.backupDownload}</button></div>
    <p class="hint">ID: ${participantId}</p>`);
  $('#dl').addEventListener('click', () => downloadText(csv, filename));
}

// ---------------------------------------------------------------------------
async function main() {
  try {
    renderer = new PairRenderer(canvas);
  } catch (e) {
    console.error(e);
    showContent(T.noWebGL);
    return;
  }
  respBar.innerHTML = `
    <button data-resp="same" disabled>${T.same} <kbd>${CONFIG.keyLabels.same}</kbd></button>
    <button data-resp="different" disabled>${T.different} <kbd>${CONFIG.keyLabels.different}</kbd></button>`;
  window.addEventListener('resize', () => { if (!stage.hidden) { renderer.resize(); renderer.render(); } });
  window.addEventListener('beforeunload', (e) => {
    if (running) { e.preventDefault(); e.returnValue = T.leaveWarning; }
  });
  // Space would scroll the page; arrow keys etc. are harmless.
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target === document.body) e.preventDefault(); });

  await screenWelcome();
  running = true;
  await screenDemographics();
  await screenInstructions();
  await runBlock(design.practice, 0, 0);
  await screenPracticeDone();
  await runBlock(design.train, 1, 0);
  await screenBreak();
  await runBlock(design.test, 2, design.train.length);
  await screenPost();
  await finish();
}

main();
