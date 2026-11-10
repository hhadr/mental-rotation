# Mental rotation – cube snakes

A browser experiment in the style of Shepard & Metzler: the participant sees two 3D objects made of cubes and decides
whether the right one is the **same** object, only rotated (key `F`), or its **mirror image** (`J`).
It is a static site with no build step, so it runs on GitHub Pages as is.

## Design

| | Round 1 – training | Round 2 – test |
|---|---|---|
| Trials | 20 unique shapes | 10 **repeated** from round 1 + 10 **new** |
| Feedback | correct/wrong, then an animation of the left object rotating (and mirror-flipping for *different* trials) into the right one's pose, cubes coloured by segment | none |
| Same / different | 10 / 10 | 5 / 5 among repeated, 5 / 5 among new |

* **Practice**: 3 pairs before round 1 (`practiceTrials`), with round-1 feedback. They use their own 3-bend shapes, which appear
  nowhere else, and are not saved.
* **Complexity design**: 10 slots of *(cubes, bends)*, set in `complexitySlots`. Cubes are 7/8/9/10/11 (the range used by
  [Ganis & Kievit, 2015](https://openpsychologydata.metajnl.com/articles/10.5334/jopd.ai)) and bends are 2/4, fully crossed.
  Among the 4-bend levels, 7/9/11 cubes have one out-of-plane bend and 8/10 cubes have two (the optional third value in a slot); stricter visibility would leave almost only shapes with one. Each slot makes 3 unique shapes: two for round 1, one of which comes back in round 2, and one new shape
  for round 2. That way the **repeated and new test shapes are matched in complexity**.
* **Shapes** are self-avoiding paths on a grid with 90° bends. Cubes that aren't neighbours in the chain never share a face.
  Every shape is **chiral**, so its mirror can never be produced by rotation and *different* trials are never ambiguous.
  All 30 shapes are unique up to rotation and reflection.
* **Every cube is visible.** Ganis & Kievit minimised self-occlusion when choosing views; here it is measured for each cube.
  `js/visibility.js` runs a z-buffer with the renderer's camera. A cube's score is its visible area divided by its area if drawn alone.
  Every cube must score at least `minCubeVisibility` (0.25) in the left image and in both possible right images (same and mirror),
  because counterbalancing can swap them. Each trial uses the clearest of 400 random views, and shapes without clear views at
  every angle are discarded. The lowest score in the current set is 0.255, recorded per trial as `min_cube_visible`.
* **Angular disparity** is 30/60/90/120/150°. The rotation is about the vertical axis (depth) or the picture plane.
  Both are balanced within each condition.
* **Repeated shapes** in round 2 are shown from a new viewpoint and at a new angle (`repeatNewView`). About half keep
  their round-1 answer and half switch it (`same_condition_as_train`), so remembering the answer doesn't help.
* **Pre-generated stimuli**: `js/stimuli.js` holds the 30 shapes and all trials, so every participant and the VLM get the same set.
  After changing any stimulus setting in `js/config.js`, run `node tools/build-stimuli.mjs` (about 35 s).
  The experiment refuses to start if the file is out of date. The set's identifier is saved as `stimulus_hash`.
  Only the trial order is random for each participant (at most 3 identical answers in a row).
* **Counterbalancing**: group 1 (random, or forced with `?group=1`) swaps same↔different on every trial.
* Timing: 500 ms fixation, stimulus until response (30 s timeout), 400 ms ITI in round 2.
  RT is measured from the frame the stimulus appears to `event.timeStamp` of the key press.

## Recorded data (one CSV row per trial)

Participant: `participant_id`, `group`, `order_seed`, `stimulus_hash`, age, gender, handedness, prior experience, whether they noticed
repeats, difficulty rating, strategy, browser and screen info, duration.

Trial: `block`/`round`, `phase` (`train` / `test_repeated` / `test_new`), `trial_index`, `global_index`, `shape_id`,
`condition`, `angle`, `axis`, view parameters, `min_cube_visible`, `response`, `correct`, `rt_ms`, `timeout`, `response_method`,
`feedback_ms` (time spent viewing the round-1 feedback) and `feedback_replays`.
Repeated trials are also linked to their round-1 trial: `train_condition`, `train_angle`, `train_correct`, `train_rt_ms`.

Shape complexity: `n_cubes`, `n_bends`, `n_nonplanar_bends`, `n_zigzag_bends`, `n_uturn_bends`,
`bend_sequence` (one letter per bend after the first: Z = zig-zag, U = U-turn, R/L = right/left-handed out-of-plane bend),
`handedness_changes`, `segment_lengths`, `bbox`, `compactness`, `radius_of_gyration`, plus `voxels`, the full cube
coordinates, so you can compute any other metric later.

## Run locally

ES modules need a web server (opening `file://` won't work):

```bash
cd mental-rotation
python3 -m http.server 8000
# http://localhost:8000/            experiment   (?lang=en, ?pid=XYZ, ?group=0|1)
# http://localhost:8000/export.html stimulus export for the VLM
```

## Data storage – pick one in `js/config.js`

GitHub Pages only serves static files, so the data has to go somewhere else.

1. **Google Sheet (`gas`, the current setting)**
   1. Create a new Google Sheet, open **Extensions → Apps Script**, replace the code with `backend/google-apps-script.gs`, and save.
   2. Choose **Deploy → New deployment → Web app**, with *Execute as: Me* and *Who has access: Anyone*, then allow the permissions.
   3. Open the `…/exec` URL in a browser. It should show `{"ok":true,…}`.
   4. Put the URL in `js/config.js` as `gasUrl`.

   Each participant adds one row per trial to the `data` tab. Every value is stored as text, so the sheet matches the CSV
   exactly regardless of the sheet's locale. A participant's submission is stored only once, even if the browser retries it.
   To analyse the data, open the `data` tab, choose **File → Download → Comma-separated values**, and put the file in the
   folder you pass to `analyze.py`. Until `gasUrl` is set, the end screen reports that sending failed and offers the CSV.
2. **DataPipe → OSF**
   1. Create an OSF project and an OSF token, then log in at <https://pipe.jspsych.org> and connect OSF.
   2. Create an experiment in DataPipe, **enable data collection**, and copy its experiment ID.
   3. In `config.js`, set `dataBackend: 'datapipe'` and `datapipeExperimentId: '…'`.
   Each participant becomes one CSV file in OSF.
3. **`download`**: no server. The participant downloads the CSV at the end and sends it to you.

The participant only sees the "saved" message after the backend confirms it. Otherwise they are asked to download the CSV
and send it to you. In every mode the end screen also offers a CSV download as a backup, and a copy is kept in `localStorage`.

## Publish on GitHub Pages

```bash
cd mental-rotation
git init && git add . && git commit -m "Mental rotation experiment"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Then go to the repository's **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**.
The site appears at `https://<user>.github.io/<repo>/` after a minute.
Send participants e.g. `https://<user>.github.io/<repo>/?lang=cs`.
**Do a full test run with the real backend before sharing the link.**

## Stimuli for the VLM

Open `export.html` and click *Render & download ZIP*. It contains:
* `r1_XX_*.png` / `r2_XX_*.png`: the trial images (1024×512). These are the same stimuli the humans see.
* `r1_XX_*_solution.png`: the left object rotated into the right one's pose, coloured, for feedback in round 1.
* `manifest.csv`: order, correct answer, angle, axis, phase (repeated/new) and every complexity metric.
* `prompt.txt`: an instruction prompt; `design.json`: the seeds and config used.

## Analysis

```bash
cd analysis
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python analyze.py /path/to/csv_folder            # writes /path/to/csv_folder/results/
python analyze.py --simulate 25 /tmp/sim         # dry run on simulated data
```

The script excludes participants below 55 % accuracy, trials faster than 200 ms, timeouts, and RTs beyond 3 SD
(by log RT, per participant). RT analyses use correct trials only. It then reports:

* **H1**: median RT and accuracy in round 1 vs round 2 (paired t-test, Wilcoxon, dz).
* **Learning type**: test *new* vs *repeated* (shape-specific learning) and round 1 vs test *new*
  (general/procedural learning).
* **LMM** of log RT ~ phase + angle + cubes + bends + out-of-plane bends + condition + axis, with a random participant
  intercept and a shape variance component. A second model tests **block × complexity** interactions (does learning
  depend on complexity?).
* **GEE logistic** model for accuracy.
* `overview.png` (RT across trials, RT vs angle, accuracy by complexity) and `participant_summary.csv`.

Note: statsmodels can't fit fully crossed participant × shape random effects. For the final model, consider R:
`lmer(log_rt ~ phase + angle + n_cubes + n_bends + n_nonplanar_bends + (1|participant_id) + (1|shape_id))`.

## Files

```
index.html            experiment page          js/experiment.js  flow, timing, data rows
export.html           VLM stimulus export      js/design.js      trial list (pure JS, seeded)
js/config.js          ALL settings             js/shapes.js      snake generation, chirality, metrics
js/i18n.js            Czech / English texts    js/renderer.js    three.js rendering + animation
js/stimuli.js         generated stimulus set   js/visibility.js  per-cube visibility check
tools/build-stimuli.mjs  regenerates js/stimuli.js
backend/google-apps-script.gs                  analysis/analyze.py
```
