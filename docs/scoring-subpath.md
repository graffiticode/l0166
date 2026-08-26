# Scoring should not require the renderer

**Status:** open · **Affects:** `@graffiticode/l0166`, and every consumer of its scoring
functions (today: L0166's and L0179's Learnosity custom question types)

## The problem

`scoreCells` and `getCellsValidation` are exported from
`packages/app/lib/components/form/TableEditor.tsx` — the same 3,533-line module that implements
the ProseMirror grid. The package has a single entry that exports `Form`, `View`, `scoreCells`
and `getCellsValidation` together, and `packages/app/package.json` does **not** declare
`sideEffects: false`.

A consumer that wants only `scoreCells` therefore gets React, ProseMirror and the entire
spreadsheet editor. No import path avoids it, and no bundler can tree-shake it away.

## What it costs

| bundle | size | what it needs |
| :-- | --: | :-- |
| L0166 `scorer.js` (deployed) | 632,515 b | `scoreCells` |
| L0179 `scorer.js` | 583,140 b | `scoreCells` |

Learnosity fetches `scorer.js` for every question render, and **also runs it server-side**.
Neither bundle can be loaded in bare Node: both throw `ReferenceError: document is not defined`
at import time, because pulling the entry evaluates the renderer. Verified against the deployed
bundle and against a local build.

## Why it is fixable

The scoring chain does not touch React or ProseMirror. In `TableEditor.tsx`:

```
scoreCells (837) → getCellsValidation (829) → getRegionValidations (681)
                                            → getCellsValidationFromRegionValidation (663)
                 → scoreCell (508) → evaluateExpectedFormula (483) → @graffiticode/translatex
                                                                   → ./translatex-rules.js
                                   → equivValue (473) / equivFormula (456)
                                   → normalizeDateInput (323) / normalizeNumberInput (208)
```

Every leaf is either pure or depends on `@graffiticode/translatex`, which is a formula
evaluator with no DOM requirement.

## Proposed change

1. Move that chain out of `TableEditor.tsx` into `packages/app/lib/scoring.ts`, importing
   nothing but `@graffiticode/translatex` and `./components/form/translatex-rules.js`.
   `TableEditor.tsx` imports from it, so the renderer is unaffected.
2. Add a `./scoring` subpath export, built as its own entry.
3. Declare `sideEffects` accurately (the CSS imports are side effects; the modules are not).

Consumers then import `@graffiticode/l0166/scoring`, and both Learnosity scorer bundles should
drop by roughly 500 kB and become loadable without a DOM.

## Care required

`getCellsValidation` reads `validation.regions || validation.ranges` — `ranges` is the legacy
shape and must keep working. `rowInRegion`'s `||`-should-be-`&&` is deliberate and pinned by
L0179's differential test (see `l0179/packages/core/src/validation.ts`); do not "fix" it as part
of this move. The extraction must be behaviour-preserving — it is a move, not a rewrite.

## Related

`docs/partial-scoring.md` describes the scoring contract itself. A separate, larger question is
whether L0179 should depend on this package at all — see `l0179/docs/shed-l0166.md`.
