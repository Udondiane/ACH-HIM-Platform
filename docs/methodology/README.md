# HIM Scoring Methodology — Reference

Living reference for the HIM Platform's scoring layer. This document sits alongside the code that implements it (`lib/scoring/*`) and is versioned in the same repository.

**Last updated:** 2026-09-24 (two-step derivation finalised)

---

## 1 · What the scoring library does

The Holistic Impact Metric (HIM) is a single 0–1 score summarising a person's capability across 7 domains of integration, computed at each assessment timepoint (baseline / 3mo / 6mo / 12mo).

Master equation (`lib/scoring/him.ts`):

> **HIM = α × Core + β × Optional**
>
> where Core and Optional are the mean domain scores in the project's *core* and *optional* capability sets, each normalised to 0–1.

---

## 2 · Theoretical foundations

| Foundation | Origin | Where in the code |
|---|---|---|
| **Sen's Capability Approach** | Amartya Sen — *Development as Freedom* (1999); Nussbaum's *Central Capabilities* | The 7-domain structure; the *personal / social / environmental* conversion factor types (`006_capability_framework.sql`, `types.ts`) |
| **Analytic Hierarchy Process (AHP)** | Saaty (1977, 1980) | The α/β weight resolution: `α = r/(r+1), β = 1/(r+1)`. `lib/scoring/weights.ts` |
| **Modified Delphi consensus** | Dalkey & Helmer (1963); Linstone & Turoff (1975) | Panel consensus rules — ≥70% modal agreement OR IQR ≤ 1 scale point. `lib/scoring/delphi.ts`; migration `014_delphi_panels.sql` |
| **Social Return on Investment** | Social Value International SROI guide | Proportional valuation: `(uplift / 5) × £proxy`. `lib/scoring/sroi.ts` |
| **Bamberger PREM / real-world evaluation** | Michael Bamberger + Michael Quinn Patton | Dual-basis reporting: Completers *and* Intention-to-Treat, always both. `lib/scoring/uplift.ts` |

---

## 3 · The seven capability domains

Aligned with EU MIPEX (Migrant Integration Policy Index) and UK Home Office integration indicators:

1. **Employment** — access, sustain, progress in paid work
2. **Housing** — secure and maintain stable housing
3. **Education & Skills** — acquire and use skills / qualifications
4. **Health & Wellbeing** — physical + mental, agency
5. **Belonging & Identity** — belonging, identity, dignity in community
6. **Social Participation** — networks, civic life, connection
7. **Rights & Citizenship** — knowledge and exercise of rights

---

## 4 · Project classification — the two-step derivation

**Finalised 2026-09-24** to reconcile the methodology doc, the code, and the Delphi Round 1 (July 2026) findings. Prior versions of this document described a single-mechanism derivation from capability counts; that is superseded.

### Step 1 · Project type from the classification questionnaire

Every project answers four A/B/C questions at design time (methodology doc §5.2):

- **Q1** — Primary objective
- **Q2** — Participation intensity
- **Q3** — Service delivery
- **Q4** — Expected change pattern

Scoring: A = 2, C = 1, B = 0. Total (0–8) determines type:

| Total | Type |
|---|---|
| **6–8** | Depth-oriented |
| **3–5** | Hybrid |
| **0–2** | Breadth-oriented |

**Fallback for projects with no questionnaire answers:** infer type from capability counts — `coreCount === 0 → breadth`, otherwise `depth`. Hybrid is only reachable via the questionnaire because it requires deliberate acknowledgement of dual intent.

### Step 2 · Weight ratio within the type

Uses Delphi Round 1 (July 2026) evidence-based 2:1 defaults (softer than the pre-Round-1 3:1):

| Type | Default | Escalation |
|---|---|---|
| **Depth** | `d2_1` (α=0.67, β=0.33) | `d3_1` (α=0.75) only when 3 Core + 0 Optional (pure-depth intent) |
| **Breadth** | `b2_1` (α=0.33, β=0.67) | `b3_1` (β=0.75) only when 0 Core + 3+ Optional (pure-breadth intent) |
| **Hybrid** | `hybridOptionA` (α=β=0.50) | None. Round 1 reached 72.7% modal consensus on fixed equal weights. `weight_ratio` stored as canonical `d1_1`. |

### Why the two-step design

- **Reconciles doc and code** — the questionnaire now drives type as the methodology doc always specified; capability counts refine within-type nuance.
- **Adopts Delphi Round 1 recommendations** — 2:1 defaults where the panel's centre of gravity landed, with pure-intent escalation to 3:1 only when the operator has unambiguously indicated it.
- **Fixes hybrid unreachability** — under the prior lookup table only the single Core=3 + Optional=2 configuration produced hybrid. Now any questionnaire total 3–5 does.
- **Makes the questionnaire meaningful** — previously captured and stored but never influenced scoring. Now the primary type-selection signal.

Implementation: `lib/projects/schema.ts::deriveTypeAndWeight()` and tested in `tests/scoring/two-step-derivation.test.ts`.

---

## 5 · Score bands — plain-English interpretation

Every 0–5 mean is mapped to one of five anchor bands via `lib/scoring/interpret.ts`:

| Level | Label |
|---|---|
| 1 | cannot do / avoids |
| 2 | with support |
| 3 | independently |
| 4 | confidently |
| 5 | teaches / leads |

Reports display level bands alongside numeric scores so decision-makers can read outcomes without methodology knowledge.

---

## 6 · Uplift reporting doctrine

Every Capability Investor report carries TWO numbers per domain (`lib/scoring/uplift.ts`):

- **Completers** — average across candidates who completed baseline + exit
- **Intention-to-Treat (ITT)** — average across ALL starters; dropouts held at baseline (zero uplift)

Comment in the code: *"The cardinal sin in evaluation is dropping leavers from the denominator to flatter the result."*

---

## 7 · SROI translation

`sroi.ts` — proportional valuation:

```
sroi_contribution = (uplift / 5) × proxy_value
```

A candidate whose Employment capability rose from 1.5 → 3.5 (uplift 2.0 on 0–5 scale) contributes `(2.0/5) × proxy_value` to the Employment SROI total.

Two figures reported per capability (Completers and ITT), mirroring the uplift split.

---

## 8 · Change log

| Date | Change | Rationale |
|---|---|---|
| **2026-09-24** | Two-step derivation finalised: questionnaire → type, counts → ratio within type. Delphi Round 1 2:1 defaults adopted. Hybrid reachable via any questionnaire total 3–5. Migration `069_reseed_project_weights.sql` applies to existing projects with override-lock guard. | Reconciles methodology doc, code, and Delphi Round 1 evidence. |
| **2026-07-29** | Delphi Round 1 findings report published (11 respondents, Aston + CREME + ACH). Panel recommended softening single-type defaults from 3:1 to 2:1. | Panel-validated methodology refinement. |
| **Prior versions** | Single-mechanism lookup-table derivation from capability counts only; questionnaire captured but not used; d3_1/b3_1 as defaults. | Superseded by the two-step design. |

---

## 9 · Reference documents

- `HIM_Weighting_Methodology.docx` — the methodology doc (Section 5.2 describes the questionnaire; Section 5 is updated to reflect the two-step design and Round 1 defaults)
- `HIM_Delphi_Round1_Findings.md` — the July 2026 expert consultation full report
- `lib/scoring/README.md` — code-level implementation notes (if present)
- `lib/projects/schema.ts::deriveTypeAndWeight()` — the derivation function itself
- `supabase/migrations/069_reseed_project_weights.sql` — the reseed of existing projects
- `tests/scoring/two-step-derivation.test.ts` — load-bearing test cases
