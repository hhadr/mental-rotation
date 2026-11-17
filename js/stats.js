// Per-round summary shown to the participant on the end screen.
// Response times include every answered trial (correct or not); timeouts are left out.
export function summarizeRounds(rows) {
  return [1, 2].map((round) => {
    const trials = rows.filter((r) => r.round === round);
    const rts = trials.map((r) => r.rt_ms).filter((v) => typeof v === 'number');
    const correct = trials.filter((r) => r.correct === 1).length;
    return {
      round,
      n: trials.length,
      correct,
      accuracy: trials.length ? correct / trials.length : null,
      meanRt: rts.length ? rts.reduce((s, v) => s + v, 0) / rts.length : null,
      minRt: rts.length ? Math.min(...rts) : null,
      maxRt: rts.length ? Math.max(...rts) : null,
    };
  });
}

// How much faster round 2 was than round 1, as a fraction of the round-1 mean
// (0.38 = 38 % faster, negative = slower); null if a round has no answered trials.
export function rtImprovement(rounds) {
  const [r1, r2] = rounds;
  if (r1.meanRt === null || r2.meanRt === null) return null;
  return (r1.meanRt - r2.meanRt) / r1.meanRt;
}
