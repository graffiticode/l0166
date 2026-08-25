# Partial scoring: requirements

**Status:** implemented 2026-08-25 — see Resolution below
**Raised:** 2026-08-24, from a model-eval sweep of L0166 (console repo)

## Summary

Per-cell point weighting is implemented at both ends of L0166 and unreachable from the
middle. The runtime scorer reads `points` off a cell's assess config; the compiler's
validation pass sums `assess.points` into a total. But `points` is not in the lexicon, so
**no L0166 program can set it**. Every assessed cell is therefore worth exactly the default,
1 point, and there is no way to say otherwise.

`spec/scope.json` advertises the capability to every agent that calls `get_language_info`:

```
"Assessed cells: value-equivalence, formula-equivalence, points, partial credit"
```

That claim is currently false at the language surface.

## How it surfaced, and why it had not before

A sweep of 12 L0166 cases authored from the public MCP surface (console:
`data/model-eval/mcp/0166.json`, case `assessed-partial-credit-multi-cell`) asked for
"2 points per cell with partial credit". Four models, three trials each:

- `gpt-5.6-luna` wrote `points`, got `Undefined reference 'points'`, and the error-correction
  pass **dropped the requirement** to make it compile. 3 of 3 trials.
- `claude-haiku-4-5`, `claude-sonnet-5`, and `gpt-5.6-terra` never attempted `points` at all
  and "passed first-pass".

All 12 runs ended as a 100% compile with zero warnings, and all 12 produced a spreadsheet
that ignores the points the request asked for. Nothing is surfaced to the caller in either
path — the failing one repairs into silence, the passing ones were never wrong out loud.

This is why it had gone unnoticed: the six pre-existing eval cases (console:
`data/model-eval/0166.json`) are all display-and-formula scenarios that never ask for
weighted scoring, and a capability nothing exercises cannot fail.

## Current state (verified 2026-08-24)

Line numbers are anchors, not contracts — follow the symbol.

| Layer | Where | State |
| :---- | :---- | :---- |
| Runtime scorer | `packages/app/lib/components/form/TableEditor.tsx` `scoreCell` (~L508) | **Implemented.** Signature is `({ method, expected, points = 1 }, …)`; returns `{ points, isValid }`. |
| Score aggregation | same file, `scoreCells` (~L837) | **Implemented.** Scores each assessed cell independently and attaches `score` per cell. |
| Compiled validation | `packages/api/src/compiler.js` `getValidation` (~L53) | **Implemented.** Reads `cells[key].assess.points`, falls back to 1 per assessed cell, accumulates `points` total. |
| Language surface | `packages/api/src/lexicon.js` (~L38) | **Missing.** `assess`, `method`, `expected` are defined. `points` is not. |
| Checker / transformer | `packages/api/src/compiler.js` `ASSESS`/`METHOD`/`EXPECTED` (~L141, ~L497) | **Missing the pair.** `ASSESS` already builds an open record by merging its member values, so a `POINTS` pair drops in beside `EXPECTED` with no change to `ASSESS` itself. |
| Docs | `spec/instructions.md`, `spec/usage-guide.md`, `spec/examples.md` | **Missing.** Zero occurrences of "points", "partial", "credit", or "score". The code generator writes from these, so an undocumented keyword stays unused even once it parses. |
| Catalog claim | `spec/scope.json` `in_scope` | **Ahead of the implementation.** |

Note what this means for effort: the semantics are already decided and shipped. Per-cell
independent scoring — which is what "partial credit" means here — has always worked; what is
missing is the ability to weight the cells. This is a surface change, not a scoring redesign.

## Requirements

**R1. `points` is authorable as a member of `assess`.**
```
cell "D2" text "" assess [method "value" expected "836" points 2] {}
```
Parses, checks, and reaches the compiled cell as `assess.points: 2`.

**R2. The default does not change.** An `assess` with no `points` is worth 1, exactly as
today. Every existing program, training example, and stored item must compile and score
identically after this change. This is the back-compatibility constraint that makes the
change safe to ship without a corpus migration.

**R3. The validation total reflects authored points.** `getValidation`'s `points` total is
the sum of per-cell values, so a 3-cell grid at 2 points each reports 6, not 3.

**R4. Invalid `points` fails at compile time, with a message that says what is allowed.**
Silent coercion is what produced this bug in the first place: the repair loop is very willing
to make an error disappear, and a warning nobody reads is indistinguishable from working. See
Open decisions for what counts as invalid.

**R5. Documented in all three spec surfaces before it is considered done** —
`instructions.md` (the code generator writes from this), `usage-guide.md` (the agent-facing
guide behind `get_language_info`), and at least one worked example in `examples.md` (the RAG
corpus). A keyword that parses but is undocumented will not be used by generated code, which
is indistinguishable from not shipping it.

**R6. `spec/scope.json` and the language's advertised capabilities end up true.** Either the
claim becomes accurate by satisfying R1–R5, or — if this is deferred — the words "points,
partial credit" come out of `in_scope` in the meantime. An advertised capability that does not
exist is worse than an absent one: it actively invites the request that fails silently.

## Resolution (2026-08-25)

R1–R6 are done in `packages/api`. `points` is an arity-1 lexicon entry alongside
`method`/`expected`, with a Checker rule that rejects negatives and non-numbers, a Transformer
rule that passes the value through untouched, and a `resolveInheritedPoints` pass in
`Transformer.PROG` that folds row/column weights onto each assessed cell before `getValidation`
runs. `packages/app` is unchanged.

Two things found during implementation that were not in the original writeup:

- **Basis `Checker.LIST` visits only its first element.** A `POINTS` checker error in a
  trailing assess position was therefore silently dropped — `assess [method … expected … points -1]`
  compiled clean with `points: -1`, verified empirically. `Checker.ASSESS` now walks the assess
  list's members itself. Overriding `LIST` globally was rejected: it would newly surface
  errors swallowed for every cell after the first in `cells [...]`, breaking existing programs.
- **The host contract is `validation.points`, and it already existed.** L0176's `buildCustom`
  reads nothing out of L0166's compiled output — it only points Learnosity at this repo's
  `public/scorer.js`, whose `maxScore()` returns `question.data.validation.points`, while
  `score()` sums each cell's `assess.points`. Because those two numbers come from different
  places, folding inherited points onto the cells is a correctness requirement, not a
  convenience: otherwise a fully correct response could never reach the maximum and
  `isValid()` would be permanently false. No envelope change was needed, and no rebundle —
  `public/scorer.js` and `public/question.js` are checked-in prebuilt artifacts with no source
  in this repo, and they already carry the `points` logic.

Decisions taken:

1. **Fractional points:** allowed. Non-negative numbers generally.
2. **`points 0`:** meaningful and preserved — the cell is still checked and coloured but adds
   nothing. Both the transformer and the inheritance pass test for the key, never truthiness.
3. **Negative points:** rejected at compile time (`E_INVALID_POINTS`).
4. **Row/region and column points:** supported, resolved at compile time. Precedence is
   cell > row > column. Note `rowInRegion` has a pre-existing `||`-should-be-`&&` bug, so
   inherited points resolve regions exactly as `order` and `index` already do — consistent with
   existing behavior, and left alone rather than fixed silently here.
5. **Learnosity host:** `validation.points`, unchanged. `scope.json` was corrected to name
   L0176 rather than L0158.

Still open: the console eval case `assessed-partial-credit-multi-cell` has not been re-run —
that repo was out of scope for this change.

## Original open decisions (product, not implementation)

These are yours; I have deliberately not assumed answers.

1. **Fractional or integer points?** `scoreCell` returns whatever it is given, so `0.5` would
   flow through. Allowing it is free; forbidding it is a validation rule. Learnosity hosting
   (below) may constrain this.
2. **Is `points 0` meaningful?** A cell that is checked and coloured for the learner but
   contributes nothing to the score is a real authoring need (practice rows, worked examples).
   If yes, `0` must be distinguishable from "unset", which currently both read as falsy —
   `getValidation`'s `typeof points === "number" ? points : 1` handles this correctly today,
   but the transformer must not normalise `0` away.
3. **Negative points?** Recommend rejecting, but it is a decision.
4. **Row- and region-level points.** `row "*" assess [method "value" expected "actual"]`
   already exists and carries an `order`. Should `points` be settable there and inherited by
   the row's cells, with per-cell overriding? This is the difference between a one-line
   authoring change and a 30-row grid needing 30 annotations.
5. **How maximum points reach a Learnosity host.** L0158 embeds L0166 as a `custom` question
   whose scoring is this widget's own `scorer.js`, with no `valid-response` emitted. If the
   host needs a max score to report an item's worth, the validation total has to be surfaced
   in the compiled envelope in a shape L0158 reads. Worth confirming with that repo before
   fixing the shape — it is the one requirement here with a cross-repo contract.

## Verification

The failing case already exists: run the eval harness against
`data/model-eval/mcp/0166.json`, case `assessed-partial-credit-multi-cell`, and require that
the generated program contains `points 2` on each assessed cell **and** compiles. Assert on
the compiled validation total (6), not on the source text — source-shape assertions have
produced false passes on this stack before.

A regression guard belongs next to the existing spec tests: every `assess` in `spec/` still
compiles, and a program with explicit `points` reports the expected total.

## Non-goals

- Rubric or prose scoring — out of scope for a spreadsheet dialect, per `scope.json`.
- Per-cell fractional credit *within* one cell (a partly-right answer earning part of a
  cell's points). Cells are equivalence-checked; they are right or wrong.
- Changing how `method "value"` / `method "formula"` decide correctness.
