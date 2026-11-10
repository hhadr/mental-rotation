// ---------------------------------------------------------------------------
// Experiment configuration. Everything you might want to tweak lives here.
// ---------------------------------------------------------------------------
export const CONFIG = {
  experimentName: 'mental-rotation-snakes',
  version: '1.2.0',
  defaultLang: 'cs', // 'cs' | 'en'  (override with ?lang=en)

  // Stimuli are pre-generated: after changing any stimulus setting below, run
  //   node tools/build-stimuli.mjs
  // The experiment refuses to start if js/stimuli.js is out of date.
  //
  // Fixed seed => every participant (and the VLM export) gets the SAME 30 shapes,
  // the same views/angles; only trial ORDER is shuffled per participant.
  stimulusSeed: 20261104,

  // If true, half of participants (group 1) get same/different swapped for every
  // trial, so no shape is always "same". Group is random, or forced by ?group=0|1.
  counterbalanceConditions: true,

  // Complexity design: 10 slots of [nCubes, nBends, nOutOfPlaneBends (optional)]. For every slot 3 unique shapes
  // are generated: 2 go to round 1 (training), one of them is repeated in round 2,
  // the third is a NEW shape in round 2. => 20 training, 10 repeated + 10 new test.
  // Repeated and new test shapes are therefore matched in complexity.
  complexitySlots: [
    [7, 2], [7, 4, 1],
    [8, 2], [8, 4, 2],
    [9, 2], [9, 4, 1],
    [10, 2], [10, 4, 2],
    [11, 2], [11, 4, 1],
  ],
  // Practice pairs shown before round 1, in this order, with round-1 feedback. They use
  // their own shapes, are the same for both counterbalancing groups, and are not saved.
  practiceTrials: [
    { cubes: 8, bends: 3, condition: 'same', angle: 60, axis: 'y' },
    { cubes: 9, bends: 3, condition: 'different', angle: 60, axis: 'z' },
    { cubes: 8, bends: 3, condition: 'same', angle: 120, axis: 'y' },
  ],

  // Minimal arm length in steps (cubes added per straight segment). Falls back to 1
  // when the shape has too few cubes for that many bends. 2 gives chunkier arms
  // but far fewer distinct 2-bend shapes.
  minSegmentLength: 1,

  // Angular disparity between left and right object (degrees) and rotation axes.
  // Axes are screen axes: 'y' = vertical (rotation in depth), 'z' = picture plane,
  // 'x' = horizontal (rotation in depth).
  angles: [30, 60, 90, 120, 150],
  axes: ['y', 'z'],
  // Both objects are first viewed from this oblique tilt (deg about the x axis)
  // and a random yaw, so they look 3D.
  tiltRange: [20, 35],

  // Every cube must keep at least this fraction of its unobstructed projected area
  // visible, in the left image and in both possible right images. Each trial uses the
  // clearest of `viewCandidates` random views.
  // Above about 0.25, almost no shape with 2+ out-of-plane bends remains possible.
  minCubeVisibility: 0.25,
  viewCandidates: 400,
  // A repeated shape's new left-object pose differs from round 1 by at least this (deg).
  minRepeatPoseDiff: 45,

  // Repeated shapes in round 2 are shown from a NEW viewpoint/angle (true)
  // or as the identical image pair from round 1 (false).
  repeatNewView: true,

  // Response keys (KeyboardEvent.code) and their labels. On-screen buttons also work.
  keys: { same: 'KeyF', different: 'KeyJ' },
  keyLabels: { same: 'F', different: 'J' },

  // Timing (ms)
  fixationMs: 500,
  itiMs: 400,
  trialTimeoutMs: 30000,
  animDelayMs: 500,     // pause before the solution animation starts
  animRotateMs: 2200,   // rotation of left object into the right object's pose
  animHoldMs: 700,      // pause before mirroring (different trials)
  animMirrorMs: 1400,   // mirror flip (different trials)

  // ---- Data storage --------------------------------------------------------
  // 'gas'      : Google Apps Script web app -> appends rows to a Google Sheet (see README)
  // 'datapipe' : https://pipe.jspsych.org  -> saves CSV files to your OSF project
  // 'download' : no server; participant downloads the CSV at the end
  dataBackend: 'gas',
  datapipeExperimentId: '',   // e.g. 'aB3xYz9QwErT' from pipe.jspsych.org
  gasUrl: 'https://script.google.com/macros/s/AKfycbzaVGplfIGoFVCH4WBRROZb9gZfF-g197iBrHME-L7iOhaeWGgMMMRpXz6AHmDoQK-f/exec',                 // e.g. 'https://script.google.com/macros/s/XXXX/exec'
};
