# Text like "Year 1" is silently converted to a date

**Status:** open · **Affects:** `@graffiticode/l0166`, and L0179 through the shared renderer

## The problem

`normalizeDateInput` in `packages/app/lib/components/form/TableEditor.tsx` guards V8's permissive
`Date.parse` with a character allowlist:

```js
// ...ASCII letters for month names — so things like "7-4=" or "2+3" never reach
// the lenient parser.
if (/^[\dA-Za-z\s\/\-\.\,\:T]+$/.test(trimmed)) {
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) return dateToSerial(new Date(parsed));
}
```

The guard does what its comment says — it stops `7-4=` and `2+3`. But allowing ASCII letters so
month names get through also admits ordinary prose, and V8 parses far more of it than expected:

| cell text | becomes |
| :-- | :-- |
| `Year 1` | 2001-01-01 |
| `Year 2` | 2001-02-01 |
| `Quarter 1` | 2001-01-01 |
| `Month 5` | 2001-05-01 |
| `Yr 1` | 2001-01-01 |
| `Year-1` | 2001-01-01 |

These are among the most common column headers in a financial or assessment spreadsheet. A
"Year 1 / Year 2 / Year 3" header row renders as three dates, and the author has no indication
why. Found while regenerating the Learnosity demo fixture, whose header row used exactly this.

`Year One`, `Y1`, `FY1` and `1st Year` all survive, so the workaround is to avoid a bare trailing
number — but that is a trap, not a fix.

## Why it is not a one-line change

Tightening the allowlist is easy; deciding what should still parse is not. The behaviour is
load-bearing for authored content that *is* dates, and cells are also compared this way during
scoring — `scoreCell` derives `expectedType` from the same normalizer, so a change moves both
what renders and what counts as correct. Any fix wants the corpus replayed through it, the way
`l0179/packages/core/tools/differential-test.mjs` replays compiler changes.

A plausible shape: require a digit-led token or an explicit month name, rather than admitting any
letters. `Jan 1`, `2024-03-05`, `3/5/2024` keep working; `Year 1` and `Quarter 1` stop being
dates. Worth confirming against real authored items before committing to it.

## Related

`docs/scoring-subpath.md` — extracting the scoring chain, which includes this normalizer, out of
the renderer. Doing that first would make this testable without a DOM.
