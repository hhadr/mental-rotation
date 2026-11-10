// All participant-facing text. Add a language by copying one block.
const K = (k) => `<kbd>${k}</kbd>`;

export const STRINGS = {
  cs: {
    title: 'Mentální rotace 3D objektů',
    welcome: () => `
      <h1>Mentální rotace 3D objektů</h1>
      <p>Děkujeme, že jste se rozhodl(a) zúčastnit našeho experimentu zaměřeného na prostorovou představivost.</p>
      <p>Experiment trvá přibližně <b>10–15 minut</b>. Proveďte jej prosím na <b>počítači s klávesnicí</b>,
      v klidném prostředí a bez přerušení.</p>
      <h2>Informovaný souhlas</h2>
      <ul>
        <li>Účast je zcela dobrovolná. Experiment můžete kdykoli ukončit zavřením okna.</li>
        <li>Zaznamenáváme pouze vaše odpovědi, reakční časy, údaje, které sami vyplníte, a základní technické údaje o prohlížeči.</li>
        <li>Data jsou anonymní a budou použita výhradně pro studijní a výzkumné účely.</li>
      </ul>`,
    consentCheck: 'Souhlasím s účastí a se zpracováním anonymních dat.',
    smallScreen: 'Vaše obrazovka je pravděpodobně příliš malá. Experiment je určen pro počítač nebo notebook s klávesnicí.',
    noWebGL: '<h1>Chyba</h1><p>Váš prohlížeč nepodporuje WebGL, které je pro experiment nutné. Zkuste prosím jiný prohlížeč (Chrome, Firefox, Edge).</p>',
    continue: 'Pokračovat',
    demoHeading: 'Základní údaje',
    age: 'Věk',
    gender: 'Pohlaví',
    genders: { female: 'žena', male: 'muž', other: 'jiné', na: 'nechci uvádět' },
    hand: 'Dominantní ruka',
    hands: { right: 'pravá', left: 'levá', both: 'obě' },
    prior: 'Absolvoval(a) jste už někdy test mentální rotace nebo podobný test prostorové představivosti?',
    yesNo: { yes: 'ano', no: 'ne', unsure: 'nevím' },
    choose: '— vyberte —',
    instructions: (k, nPractice) => `
      <h1>Instrukce</h1>
      <p>V každém pokusu uvidíte <b>dvojici 3D objektů</b> složených z kostek. Pravý objekt je vždy nějak natočený.
      Rozhodněte, zda jde o <b>stejný objekt</b>, nebo o <b>dva různé objekty</b>:</p>
      <ul>
        <li><b>STEJNÉ</b> – klávesa ${K(k.same)}: pravý objekt je tentýž jako levý, jen otočený.</li>
        <li><b>RŮZNÉ</b> – klávesa ${K(k.different)}: pravý objekt je <i>zrcadlovým obrazem</i> levého – žádným otočením je nelze ztotožnit.</li>
      </ul>
      <p>Odpovídejte <b>co nejrychleji a zároveň co nejpřesněji</b>. Prsty mějte během experimentu na klávesách ${K(k.same)} a ${K(k.different)}.
      Před každou dvojicí se uprostřed objeví křížek <b>+</b>.</p>
      <p>Experiment má <b>2 kola po 20 dvojicích</b>. V 1. kole se po každé odpovědi dozvíte, zda byla správná,
      a uvidíte animaci, jak se levý objekt otočí do polohy pravého. Barvy kostek ukazují, které části si odpovídají.</p>
      <p>Níže si můžete prohlédnout dva příklady. Poté si vyzkoušíte <b>${nPractice} cvičné dvojice</b>, které se do výsledků nezapočítávají.</p>`,
    demoSame: 'Příklad: STEJNÉ',
    demoDiff: 'Příklad: RŮZNÉ',
    startPractice: 'Začít nácvik',
    practiceProgress: (i, n) => `Nácvik · ${i} / ${n}`,
    practiceDone: () => `
      <h1>Konec nácviku</h1>
      <p>Nácvik je u konce. Nyní začíná <b>skutečný experiment</b> a vaše odpovědi se už budou zaznamenávat.</p>
      <p>Odpovídejte <b>co nejrychleji a zároveň co nejpřesněji</b>.</p>`,
    startTraining: 'Začít 1. kolo',
    same: 'Stejné',
    different: 'Různé',
    progress: (r, i, n) => `Kolo ${r} · ${i} / ${n}`,
    correct: 'Správně',
    incorrect: 'Špatně',
    timeout: 'Vypršel čas',
    axisNames: { x: 'kolem vodorovné osy', y: 'kolem svislé osy', z: 'v rovině obrazovky' },
    explainSame: (a, ax) => `Objekty byly <b>stejné</b> – pravý je levý otočený o ${a}° ${ax}.`,
    explainDiff: (a, ax) => `Objekty byly <b>různé</b> – pravý je zrcadlový obraz levého. Ani po otočení o ${a}° ${ax} se nekryjí; je třeba je ještě zrcadlit.`,
    phase: { rotate: 'Otáčení levého objektu…', mirror: 'Zrcadlení…', done: '' },
    replay: 'Přehrát znovu',
    next: 'Pokračovat',
    spaceHint: 'nebo mezerník',
    breakScreen: () => `
      <h1>Konec 1. kola</h1>
      <p>Výborně, máte za sebou první kolo. Můžete si krátce odpočinout.</p>
      <p>Nyní následuje <b>2. kolo</b> – opět 20 dvojic. Tentokrát se <b>nebude zobrazovat zpětná vazba</b>.
      Odpovídejte opět <b>co nejrychleji a zároveň co nejpřesněji</b>.</p>`,
    startTest: 'Začít 2. kolo',
    postHeading: 'Na závěr pár otázek',
    noticed: 'Měl(a) jste ve 2. kole pocit, že se některé objekty opakovaly z 1. kola?',
    difficulty: 'Jak obtížný byl pro vás úkol? (1 = velmi snadný, 5 = velmi obtížný)',
    strategy: 'Jak jste při řešení postupoval(a)? (nepovinné)',
    finish: 'Dokončit a odeslat',
    saving: '<h1>Ukládám data…</h1><p>Nezavírejte prosím okno.</p>',
    saved: '<h1>Děkujeme!</h1><p>Data byla úspěšně uložena. Nyní můžete okno zavřít.</p>',
    saveFailed: '<h1>Téměř hotovo</h1><p>Data se nepodařilo automaticky odeslat. <b>Stáhněte si prosím soubor s daty</b> a pošlete jej organizátorům experimentu.</p>',
    downloadOnly: '<h1>Děkujeme!</h1><p>Experiment je dokončen. <b>Stáhněte si prosím soubor s daty</b> a pošlete jej organizátorům experimentu.</p>',
    download: 'Stáhnout data (CSV)',
    backupDownload: 'Záložní kopie dat (CSV)',
    leaveWarning: 'Experiment ještě neskončil. Opravdu chcete odejít?',
    required: 'Vyplňte prosím všechny povinné údaje.',
    langSwitch: '<a href="?lang=en">English version</a>',
  },

  en: {
    title: 'Mental rotation of 3D objects',
    welcome: () => `
      <h1>Mental rotation of 3D objects</h1>
      <p>Thank you for taking part in our experiment on spatial imagination.</p>
      <p>The experiment takes about <b>10–15 minutes</b>. Please do it on a <b>computer with a keyboard</b>,
      in a quiet place and without interruptions.</p>
      <h2>Informed consent</h2>
      <ul>
        <li>Participation is voluntary. You can quit at any time by closing the window.</li>
        <li>We only record your answers, response times, the information you enter, and basic technical information about your browser.</li>
        <li>The data are anonymous and will be used for study and research purposes only.</li>
      </ul>`,
    consentCheck: 'I agree to participate and to the processing of anonymous data.',
    smallScreen: 'Your screen seems too small. The experiment is designed for a desktop or laptop computer with a keyboard.',
    noWebGL: '<h1>Error</h1><p>Your browser does not support WebGL, which the experiment requires. Please try another browser (Chrome, Firefox, Edge).</p>',
    continue: 'Continue',
    demoHeading: 'About you',
    age: 'Age',
    gender: 'Gender',
    genders: { female: 'female', male: 'male', other: 'other', na: 'prefer not to say' },
    hand: 'Dominant hand',
    hands: { right: 'right', left: 'left', both: 'both' },
    prior: 'Have you ever done a mental rotation test or a similar spatial ability test?',
    yesNo: { yes: 'yes', no: 'no', unsure: 'not sure' },
    choose: '— select —',
    instructions: (k, nPractice) => `
      <h1>Instructions</h1>
      <p>In each trial you will see a <b>pair of 3D objects</b> made of cubes. The right object is always rotated somehow.
      Decide whether it is the <b>same object</b> or <b>two different objects</b>:</p>
      <ul>
        <li><b>SAME</b> – key ${K(k.same)}: the right object is the left one, only rotated.</li>
        <li><b>DIFFERENT</b> – key ${K(k.different)}: the right object is a <i>mirror image</i> of the left one – no rotation can make them match.</li>
      </ul>
      <p>Respond <b>as quickly and as accurately as possible</b>. Keep your fingers on ${K(k.same)} and ${K(k.different)} throughout.
      A cross <b>+</b> appears in the centre before each pair.</p>
      <p>There are <b>2 rounds of 20 pairs</b>. In round 1, after each answer you will see whether it was correct,
      and an animation of the left object rotating into the pose of the right one. Cube colours show which parts correspond.</p>
      <p>Two examples are shown below. After them you will try <b>${nPractice} practice pairs</b>, which do not count towards the results.</p>`,
    demoSame: 'Example: SAME',
    demoDiff: 'Example: DIFFERENT',
    startPractice: 'Start practice',
    practiceProgress: (i, n) => `Practice · ${i} / ${n}`,
    practiceDone: () => `
      <h1>End of practice</h1>
      <p>The practice is over. The <b>real experiment</b> starts now, and your answers will be recorded from here on.</p>
      <p>Respond <b>as quickly and as accurately as possible</b>.</p>`,
    startTraining: 'Start round 1',
    same: 'Same',
    different: 'Different',
    progress: (r, i, n) => `Round ${r} · ${i} / ${n}`,
    correct: 'Correct',
    incorrect: 'Wrong',
    timeout: 'Time is up',
    axisNames: { x: 'about the horizontal axis', y: 'about the vertical axis', z: 'in the picture plane' },
    explainSame: (a, ax) => `The objects were the <b>same</b> – the right one is the left one rotated by ${a}° ${ax}.`,
    explainDiff: (a, ax) => `The objects were <b>different</b> – the right one is a mirror image of the left. Even after rotating by ${a}° ${ax} they do not match; a mirror flip is needed.`,
    phase: { rotate: 'Rotating the left object…', mirror: 'Mirroring…', done: '' },
    replay: 'Replay',
    next: 'Continue',
    spaceHint: 'or press space',
    breakScreen: () => `
      <h1>End of round 1</h1>
      <p>Well done, round 1 is over. Feel free to take a short break.</p>
      <p>Now comes <b>round 2</b> – again 20 pairs. This time <b>no feedback will be shown</b>.
      Again, respond <b>as quickly and as accurately as possible</b>.</p>`,
    startTest: 'Start round 2',
    postHeading: 'A few final questions',
    noticed: 'In round 2, did you feel that some objects were repeated from round 1?',
    difficulty: 'How difficult was the task? (1 = very easy, 5 = very difficult)',
    strategy: 'How did you solve the task? (optional)',
    finish: 'Finish and submit',
    saving: '<h1>Saving data…</h1><p>Please do not close the window.</p>',
    saved: '<h1>Thank you!</h1><p>Your data were saved successfully. You can close the window now.</p>',
    saveFailed: '<h1>Almost done</h1><p>The data could not be sent automatically. <b>Please download the data file</b> and send it to the experimenters.</p>',
    downloadOnly: '<h1>Thank you!</h1><p>The experiment is finished. <b>Please download the data file</b> and send it to the experimenters.</p>',
    download: 'Download data (CSV)',
    backupDownload: 'Backup copy of data (CSV)',
    leaveWarning: 'The experiment is not finished yet. Do you really want to leave?',
    required: 'Please fill in all required fields.',
    langSwitch: '<a href="?lang=cs">Česká verze</a>',
  },
};
