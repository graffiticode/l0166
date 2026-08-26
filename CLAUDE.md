# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

L0166 is an authoring language for interactive spreadsheets, with spreadsheet-based assessment as a primary use case. This repo is a monorepo (npm workspaces).

- **packages/api**: Express.js server that compiles L0166 source and serves the application
- **packages/app**: React component library (`@graffiticode/l0166`) built with Vite that renders the spreadsheet UI
- **packages/integrations/learnosity**: Learnosity custom question type. Builds `question.js` / `scorer.js` / `question.css` straight into `packages/api/public`, which is where Learnosity loads them from.

### Compiler pipeline (packages/api)

The compiler is built on `@graffiticode/basis` and follows a three-role design — understanding this division is required to extend the language correctly:

- **`Checker`** (`src/compiler.js`): performs semantic checks per rule and returns `{ type: Type }`. Each L0166 construct (`cells`, `rows`, `columns`, `params`, `assess`, `method`, `expected`, styling keys, etc.) has a corresponding Checker method.
- **`Transformer`** (`src/compiler.js`): shapes the final output (interaction/validation payload consumed by the React app). Each Checker rule has a matching Transformer method.
- **`Compiler`**: orchestrates Checker → Transformer.

Structural types live in `src/types.js` via helpers like `t.record`, `t.number`, `t.enum`. AST nodes are **immutable** — do not attach metadata to them. Extend typing by adding/updating Checker rule methods; keep Transformer focused on data shaping.

Routes in `src/routes/` (compile, auth, config, root) wire HTTP endpoints; the server boots from `src/main.js` on port 50166. `AUTH_URL` defaults to the production Graffiticode auth service.

### React library (packages/app)

- Entry: `lib/index.ts` exports `Form`, `View`, `scoreCells`, `getCellsValidation`.
- `View` (`lib/view.jsx`) manages state and the iframe/`postMessage` protocol with the host page.
- `Form` renders the title, markdown instructions, and the Editor.
- `TableEditor` (`lib/components/form/TableEditor.tsx`) is the core spreadsheet component, built on ProseMirror tables.
- Formula evaluation uses `@graffiticode/translatex` with spreadsheet expanders; arithmetic uses `decimal.js`.
- Builds ESM (`index.es.js`) and UMD (`index.umd.js`) bundles to `dist/` for npm publish.

### Platform integrations (packages/integrations/)

`packages/integrations/<platform>/` holds code that embeds L0166 in a third-party
assessment platform. Today that is `learnosity/`; the directory is shaped to take others.

The Learnosity lifecycle code is **not** here -- it is shared across languages in
`@graffiticode/learnosity-cqt` (repo `graffiticode/integrations`, `packages/learnosity-cqt`).
This workspace is only the wiring:

```js
// packages/integrations/learnosity/src/question.js
const Question = createQuestion({ Form, scoreCells, getCellsValidation, defaultData });
```

Two things follow from that split, and both matter:

- `@graffiticode/l0166` is resolved through npm workspaces to `packages/app`, so the
  integration always builds against the language in the same commit. The old setup copied
  a `.tgz` between repos by hand and had drifted a version behind.
- Webpack writes directly into `packages/api/public/` with `clean: false`. That directory
  also holds `lexicon.js`, `spec.html`, `schema.json` and `integrations/{qti,front}` --
  and the QTI bundle has no surviving source, so wiping it is unrecoverable.

`question.js` and `scorer.js` are separate entry points on purpose: Learnosity also runs
the scorer server-side, so it must not pull in React or the renderer.

Run the local harness (Questions API + Author API, signed with Learnosity's public demo
consumer) with `npm run -w packages/integrations/learnosity demo`.

### L0166 language surface

The compiler transforms:
- `cells` / `cell`, `rows` / `row`, `columns` / `column` — layout and per-cell content/styling
- `params` — parameter templates for randomized inputs per render
- `assess`, `method`, `expected` — validation/grading criteria
- Styling keys: `width`, `align`, `protected`, `font-weight`, `font-size`, `format`, `background-color`, `color`, `border`
- Formulas (prefixed `=`): `SUM`, `AVERAGE`, `ROUND`, `IF`, plus arithmetic like `=A1+C1`

Full language reference: `packages/api/spec/spec.md` (built to `dist/spec.html`).

## Development Commands

**Root (monorepo)**:
```bash
npm run build          # Build app + api + static assets (lexicon, spec, instructions, language-info)
npm run dev            # Start API in dev mode (nodemon, Firestore emulator, local auth)
npm run start          # Start API in production mode
npm run lint           # Lint all packages
npm run lint:fix       # Auto-fix lint
npm run pack           # Pack the app for distribution (produces a .tgz)
npm run publish        # Publish @graffiticode/l0166 to npm (public)
```

**Workspace-scoped** (use `-w` to target one package):
```bash
npm run -w packages/api dev | build | build-spec | build-lexicon | coverage
npm run -w packages/app dev | build | preview
npm run -w packages/integrations/learnosity build | watch | demo
```

**Static asset builds** (`npm run build-static` runs all four):
- `build-lexicon` — generates `dist/lexicon.js` from source
- `build-spec` — runs `spec-md` over `spec/spec.md` to produce `dist/spec.html`
- `build-instructions` — generates `dist/instructions.md`
- `build-language-info` — generates language metadata

**Tests** (Jest):
```bash
npx jest packages/api/src/routes/compile.spec.js   # one file
npx jest --testPathPattern="compile"               # by pattern
npm run -w packages/api coverage                   # NYC coverage for api
```
Note: root `npm test` ignores `packages/` (see `testPathIgnorePatterns` in `package.json`). Always invoke `npx jest <path>` or use the workspace coverage script — the root `npm test` will find nothing.

**Deploy (GCP Cloud Run)**:
```bash
npm run gcp:build      # gcloud builds submit --config cloudbuild.yaml → builds & deploys
npm run gcp:deploy     # gcloud run deploy from source
npm run gcp:logs       # tail Cloud Run logs
```

## Development Environment

- Local dev sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `AUTH_URL=http://127.0.0.1:4100` (see `packages/api/package.json` dev script). Start the Firestore emulator and the Graffiticode auth service before `npm run dev`.
- The API serves the compiled React app (`packages/app/dist`) and static spec/lexicon/instructions from `packages/api/dist` + `packages/api/public`.
- Tests use Jest + supertest; spec files are colocated (e.g., `compile.spec.js` next to `compile.js`).
- ESLint is configured per package (`extends standard` for api; TS rules for app). Fix lint before opening a PR.

## Conventions

- ES modules everywhere. TypeScript preferred in `packages/app/lib`; api stays JS.
- Filenames: lowerCamelCase for JS/TS; React components in `PascalCase.tsx`.
- 2-space indent.
- Validate input shape in `Checker` (structural types), not in route handlers, when adding language features.

## TODO: Google Sheets-style edit behavior

When implementing row/column/sheet selection, mirror Google Sheets:
- The focused cell in a selection is not immediately editable (prevents accidental edits).
- Editing is enabled only by explicit action: clicking the formula bar, double-click, F2/Enter, or starting to type (which replaces content).
- Keep "selection mode" and "edit mode" visually and behaviorally distinct.
