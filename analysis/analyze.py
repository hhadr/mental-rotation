#!/usr/bin/env python3
"""Analysis of the mental-rotation cube-snake experiment.

Usage:
    python analyze.py data/                 # folder with participant CSV files
    python analyze.py --simulate 30 sim/    # create 30 fake participants first (pipeline test)

Questions answered:
  H1  Do RTs drop from round 1 to round 2 while accuracy stays the same / rises?
  H2  Is the improvement shape-specific (repeated < new shapes in round 2)
      or general (new round-2 shapes < round-1 shapes)?
  H3  Which complexity features (cubes, bends, out-of-plane bends) drive RT/accuracy,
      and does learning interact with complexity?
Outputs go to <data>/results/.
"""
import argparse
import glob
import os
import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)
try:
    from statsmodels.tools.sm_exceptions import ConvergenceWarning
    warnings.filterwarnings("ignore", category=ConvergenceWarning)
except ImportError:
    pass

PHASES = ["train", "test_new", "test_repeated"]


# ---------------------------------------------------------------------------
def load(folder):
    files = sorted(glob.glob(os.path.join(folder, "*.csv")))
    if not files:
        raise SystemExit(f"No CSV files in {folder}")
    df = pd.concat([pd.read_csv(f, encoding="utf-8-sig") for f in files], ignore_index=True)
    # The same participant may have been saved twice (upload + manual download).
    df = df.drop_duplicates(subset=["participant_id", "trial_id"], keep="last")
    print(f"Loaded {len(files)} files, {df.participant_id.nunique()} participants, {len(df)} trials")
    return df


def clean(df, min_acc, rt_min):
    df = df.copy()
    df["rt_ms"] = pd.to_numeric(df["rt_ms"], errors="coerce")
    df["valid"] = (df["timeout"] == 0) & (df["rt_ms"] >= rt_min)
    acc = df.groupby("participant_id")["correct"].mean()
    bad = acc[acc < min_acc].index.tolist()
    if bad:
        print(f"Excluding {len(bad)} participant(s) with overall accuracy < {min_acc}: {bad}")
    df = df[~df.participant_id.isin(bad)].copy()
    df["log_rt"] = np.log(df["rt_ms"])
    # RT outliers: > 3 SD from the participant's mean log RT (correct, valid trials)
    ok = df.valid & (df.correct == 1)
    stats_ = df[ok].groupby("participant_id")["log_rt"].agg(["mean", "std"])
    df = df.join(stats_, on="participant_id")
    df["rt_outlier"] = (np.abs(df.log_rt - df["mean"]) > 3 * df["std"]).fillna(False)
    df["use_rt"] = ok & ~df.rt_outlier
    df = df.drop(columns=["mean", "std"])
    df["phase"] = pd.Categorical(df["phase"], PHASES)
    for c in ["angle", "n_cubes", "n_bends", "n_nonplanar_bends", "trial_index"]:
        df[c + "_c"] = df[c] - df[c].mean()
    print(f"RT analyses: {int(df.use_rt.sum())} correct non-outlier trials "
          f"({int((df.valid == 0).sum())} timeouts/too fast, {int(df.rt_outlier.sum())} outliers)")
    return df


# ---------------------------------------------------------------------------
def paired(a, b, label, out):
    d = pd.concat([a, b], axis=1, keys=["a", "b"]).dropna()
    if len(d) < 3:
        out.append(f"{label}: not enough participants")
        return
    t = stats.ttest_rel(d.a, d.b)
    try:
        w = stats.wilcoxon(d.a, d.b)
        wtxt = f"Wilcoxon W={w.statistic:.1f}, p={w.pvalue:.4f}"
    except ValueError:
        wtxt = "Wilcoxon n/a"
    diff = d.b - d.a
    dz = diff.mean() / diff.std(ddof=1) if diff.std(ddof=1) > 0 else np.nan
    out.append(f"{label}: {d.a.mean():.3f} -> {d.b.mean():.3f} (n={len(d)}), "
               f"paired t({len(d) - 1})={t.statistic:.2f}, p={t.pvalue:.4f}, dz={dz:.2f}; {wtxt}")


def participant_tests(df, out):
    out.append("== Participant-level tests ==")
    rt = df[df.use_rt]
    pids = df.participant_id.unique()
    blocks = ["train", "test"]

    def table(d, col, by, cols, fn):
        g = d.groupby(["participant_id", by], observed=True)[col].agg(fn).unstack()
        return g.reindex(index=pids, columns=cols)

    med_block = table(rt, "rt_ms", "block", blocks, "median")
    acc_block = table(df, "correct", "block", blocks, "mean")
    med_phase = table(rt, "rt_ms", "phase", PHASES, "median")
    acc_phase = table(df, "correct", "phase", PHASES, "mean")

    out.append("H1 (round 1 -> round 2):")
    paired(med_block["train"], med_block["test"], "  median RT [ms]", out)
    paired(acc_block["train"], acc_block["test"], "  accuracy", out)
    out.append("H2 shape-specific learning (round 2: new -> repeated):")
    paired(med_phase["test_new"], med_phase["test_repeated"], "  median RT [ms]", out)
    paired(acc_phase["test_new"], acc_phase["test_repeated"], "  accuracy", out)
    out.append("H2 general learning (round 1 -> round 2 NEW shapes only):")
    paired(med_phase["train"], med_phase["test_new"], "  median RT [ms]", out)
    paired(acc_phase["train"], acc_phase["test_new"], "  accuracy", out)
    out.append("")
    summary = pd.concat({"median_rt": med_phase, "accuracy": acc_phase}, axis=1)
    return summary


def mixed_models(df, out):
    out.append("== Trial-level models ==")
    rt = df[df.use_rt].copy()
    base = "angle_c + n_cubes_c + n_bends_c + n_nonplanar_bends_c + C(condition) + C(axis)"

    def fit_lmm(formula, title):
        try:
            m = smf.mixedlm(formula, rt, groups="participant_id",
                            vc_formula={"shape": "0 + C(shape_id)"}).fit(reml=True)
        except Exception as e:  # fall back to random intercept for participant only
            out.append(f"(crossed model failed: {e}; using participant intercept only)")
            m = smf.mixedlm(formula, rt, groups="participant_id").fit(reml=True)
        out.append(f"--- {title}\n{m.summary().tables[1].to_string()}\n")
        return m

    fit_lmm(f"log_rt ~ C(phase, Treatment('train')) + {base} + trial_index_c",
            "LMM log RT: phase (vs round 1) + complexity")
    fit_lmm(f"log_rt ~ C(block) * (n_cubes_c + n_bends_c + n_nonplanar_bends_c + angle_c) + C(condition) + C(axis)",
            "LMM log RT: does learning (block) interact with complexity / angle?")

    acc = df[df.valid | (df.timeout == 1)].copy()
    try:
        g = smf.gee(f"correct ~ C(phase, Treatment('train')) + {base}", "participant_id", acc,
                    family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
        out.append("--- GEE logistic, accuracy (coefficients are log-odds)\n"
                   f"{g.summary().tables[1]}\n")
    except Exception as e:
        out.append(f"GEE failed: {e}")


def plots(df, folder):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed - skipping plots")
        return
    rt = df[df.use_rt]
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

    m = rt.groupby(["global_index", "phase"], observed=True)["rt_ms"].median().reset_index()
    for ph, c in zip(PHASES, ["#1f77b4", "#ff7f0e", "#2ca02c"]):
        s = m[m.phase == ph]
        axes[0].plot(s.global_index, s.rt_ms, "o-", color=c, label=ph, ms=4)
    axes[0].axvline(20.5, color="#999", ls="--")
    axes[0].set(xlabel="trial (1-20 round 1, 21-40 round 2)", ylabel="median RT [ms]",
                title="RT over the session")
    axes[0].legend()

    for ph, c in zip(PHASES, ["#1f77b4", "#ff7f0e", "#2ca02c"]):
        s = rt[rt.phase == ph].groupby("angle")["rt_ms"].median()
        axes[1].plot(s.index, s.values, "o-", color=c, label=ph)
    axes[1].set(xlabel="angular disparity [deg]", ylabel="median RT [ms]", title="RT vs angle")
    axes[1].legend()

    a = df.groupby(["n_cubes", "n_bends", "block"])["correct"].mean().unstack()
    labels = [f"{c}c/{b}b" for c, b in a.index]
    x = np.arange(len(a))
    axes[2].bar(x - 0.2, a.get("train", 0), 0.4, label="round 1")
    axes[2].bar(x + 0.2, a.get("test", 0), 0.4, label="round 2")
    axes[2].set_xticks(x, labels, rotation=45)
    axes[2].set(ylim=(0, 1), ylabel="accuracy", title="Accuracy by complexity (cubes/bends)")
    axes[2].legend()
    fig.tight_layout()
    fig.savefig(os.path.join(folder, "overview.png"), dpi=130)
    print(f"Saved {os.path.join(folder, 'overview.png')}")


# ---------------------------------------------------------------------------
def simulate(n, folder, seed=0):
    """Fake data with a general practice effect + an extra benefit for repeated shapes."""
    rng = np.random.default_rng(seed)
    os.makedirs(folder, exist_ok=True)
    slots = [(7, 2), (7, 4), (8, 2), (8, 4), (9, 2), (9, 4), (10, 2), (10, 4), (11, 2), (11, 4)]
    for p in range(n):
        pid = f"sim{p:03d}"
        base = rng.normal(np.log(3500), 0.25)
        rows = []
        trials = [("train", "train", s, k) for s in range(10) for k in range(2)]
        trials += [("test", "test_repeated", s, 0) for s in range(10)] + [("test", "test_new", s, 2) for s in range(10)]
        tr = [t for t in trials if t[0] == "train"]
        te = [t for t in trials if t[0] == "test"]
        rng.shuffle(tr)
        rng.shuffle(te)
        for gi, (block, phase, s, k) in enumerate(tr + te):
            nc, nb = slots[s]
            angle = int(rng.choice([30, 60, 90, 120, 150]))
            cond = str(rng.choice(["same", "different"]))
            nonpl = 1 if nb == 2 else int(rng.integers(1, 4))
            lr = (base + 0.004 * angle + 0.03 * (nc - 9) + 0.06 * (nb - 3) + 0.04 * nonpl
                  - (0.15 if block == "test" else 0) - (0.08 if phase == "test_repeated" else 0)
                  + rng.normal(0, 0.3))
            p_corr = 1 / (1 + np.exp(-(2.2 - 0.008 * (angle - 90) - 0.15 * (nb - 3) + (0.2 if block == "test" else 0))))
            rows.append(dict(participant_id=pid, block=block, phase=phase, trial_index=gi % 20 + 1,
                             global_index=gi + 1, trial_id=f"{phase}_{s}_{k}", shape_id=f"S{s}{k}",
                             condition=cond, angle=angle, axis=str(rng.choice(["y", "z"])),
                             correct=int(rng.random() < p_corr), rt_ms=round(float(np.exp(lr)), 1),
                             timeout=0, n_cubes=nc, n_bends=nb, n_nonplanar_bends=nonpl))
        pd.DataFrame(rows).to_csv(os.path.join(folder, f"{pid}.csv"), index=False)
    print(f"Simulated {n} participants into {folder}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data", help="folder with CSV files")
    ap.add_argument("--simulate", type=int, default=0, help="write N fake participants into the folder first")
    ap.add_argument("--min-acc", type=float, default=0.55, help="exclude participants below this accuracy")
    ap.add_argument("--rt-min", type=float, default=200, help="RTs below this [ms] are anticipations")
    args = ap.parse_args()

    if args.simulate:
        simulate(args.simulate, args.data)
    df = clean(load(args.data), args.min_acc, args.rt_min)
    res = os.path.join(args.data, "results")
    os.makedirs(res, exist_ok=True)

    out = []
    summary = participant_tests(df, out)
    summary.to_csv(os.path.join(res, "participant_summary.csv"))
    if df.participant_id.nunique() >= 3:
        mixed_models(df, out)
    report = "\n".join(out)
    print("\n" + report)
    with open(os.path.join(res, "report.txt"), "w", encoding="utf-8") as f:
        f.write(report)
    df.to_csv(os.path.join(res, "all_trials_clean.csv"), index=False)
    plots(df, res)


if __name__ == "__main__":
    main()
