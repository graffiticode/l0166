# Repository Guidelines

## Project Structure & Module Organization
- Root workspace: npm workspaces managing two packages.
- `packages/api/`: Node.js service with the compiler, routes, and spec assets.
  - Source: `packages/api/src/` (`compiler.js`, `util.js`, etc.)
  - Public assets: `packages/api/public/` (e.g., `spec.html`, `lexicon.js`)
  - Tools/specs: `packages/api/tools/`, `packages/api/spec/`
- `packages/app/`: React + TypeScript UI library/components.
  - Source: `packages/app/lib/` (TS/TSX; some legacy JSX)
  - Build output: `packages/*/dist/`

## Build, Test, and Development Commands
- Build all: `npm run build` (app + api builds via workspaces)
- Run API (dev): `npm run dev` (nodemon on `packages/api/src/main.js`)
- Start API (prod): `npm run start`
- Lint all: `npm run lint` | Auto-fix: `npm run lint:fix`
- App-only: `npm run -w packages/app build | dev | preview`
- API-only: `npm run -w packages/api build | dev | build-spec`

## Architecture Overview
- Basis roles: `Checker` performs semantic checks and returns `{ type: Type }`; `Transformer` shapes final output (interaction/validation); `Compiler` orchestrates both.
- Structural types live in `packages/api/src/types.js` via helpers like `t.record`, `t.number`, `t.enum`. Nodes are immutable; do not attach metadata.
- Extend typing by updating `Checker` rule methods in `packages/api/src/compiler.js`; keep `Transformer` focused on data shaping.

## Coding Style & Naming Conventions
- JavaScript/TypeScript, ES modules. Prefer TypeScript in `packages/app/lib`.
- Indentation: 2 spaces; semicolons optional but consistent.
- Linting: ESLint is configured for both packages; fix warnings before PRs.
- Filenames: lowerCamelCase for JS/TS; React components in `PascalCase.tsx`.

## Testing Guidelines
- Framework: Jest at the workspace root; NYC coverage available for API (`npm run -w packages/api coverage`).
- Co-locate tests near source or under `__tests__`. Use `*.test.ts` or `*.test.js`.
- Target critical compiler paths (`packages/api/src/compiler.js`) and UI logic in `packages/app/lib`.

## Commit & Pull Request Guidelines
- Commits: concise, imperative. Example: `fix(api): handle ALIGN enum validation`.
- PRs: include summary, motivation, screenshots for UI, and linked issues.
- CI expectations: pass build and lint. Add/update tests for behavior changes.

## Security & Configuration Tips
- Local API dev uses env vars: `FIRESTORE_EMULATOR_HOST`, `AUTH_URL` (see `packages/api/package.json` dev script).
- Do not commit secrets. Use `.env.local` and environment configuration.
- Validate inputs at API boundaries; prefer structural checks in `Checker`.
