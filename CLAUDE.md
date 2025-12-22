# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a Graffiticode language implementation (L0166) for creating spreadsheet-based assessments. The codebase is a monorepo with two packages:

- **packages/api**: Express.js server that compiles L0166 code and serves the application
- **packages/app**: React component library (`@graffiticode/l0166`) built with Vite that provides spreadsheet UI components

### Package Structure

**API Server (packages/api)**:
- Express server running on port 50166 (configurable via PORT env var)
- Compiler in `src/compiler.js` uses `@graffiticode/basis` with Checker and Transformer classes
- Each L0166 language function (CELLS, ROWS, COLUMNS, etc.) has corresponding methods in both Checker and Transformer
- Routes in `src/routes/` handle compilation and authentication
- Authentication integrates with Graffiticode auth service

**React Library (packages/app)**:
- Entry point: `lib/index.ts` exports `Form`, `View`, `scoreCells`, `getCellsValidation`
- `View` component (`lib/view.jsx`) manages state and handles iframe/message communication with host
- `Form` component renders title, instructions (markdown), and the Editor
- `TableEditor` (`lib/components/form/TableEditor.tsx`) is the core spreadsheet component using ProseMirror
- Uses `@graffiticode/translatex` with spreadsheet expanders for formula evaluation
- Outputs ESM and UMD bundles to dist/

### L0166 Language Functions

The compiler transforms these language constructs into spreadsheet configurations:
- `cells`, `cell`: Define cell content, styling, and assessment rules
- `rows`, `row`: Configure row properties and assessment ordering
- `columns`, `column`: Set column widths, alignment, and styling
- `params`: Define parameter templates for randomized cell population
- `assess`, `method`, `expected`: Define assessment/validation criteria
- Styling: `width`, `align`, `protected`, `font-weight`, `font-size`, `format`, `background-color`, `color`, `border`

Spreadsheet formulas (prefixed with `=`): `SUM`, `AVERAGE`, `ROUND`, `IF`

## Development Commands

**Root level (monorepo)**:
```bash
npm run build          # Build both API and app packages
npm run dev            # Start API server in development mode
npm run start          # Start API server in production mode
npm run lint           # Lint all packages
npm run lint:fix       # Auto-fix linting issues
npm run pack           # Package the app for distribution
npm test               # Run Jest tests (from root)
```

**Running a single test**:
```bash
npx jest packages/api/src/routes/compile.spec.js
npx jest --testPathPattern="compile"
```

**API package (packages/api)**:
```bash
npm run dev            # Start with Firestore emulator and local auth
npm run build-lexicon  # Generate lexicon.js from source
npm run build-spec     # Generate spec.html from markdown
```

**App package (packages/app)**:
```bash
npm run dev            # Start Vite dev server
npm run build          # Build library for distribution
```

## Development Environment

- Uses Firebase Firestore emulator on 127.0.0.1:8080 for local development
- Auth service runs on local port 4100 during development
- API serves compiled application and static assets from dist/ and public/
- Tests use Jest with supertest; spec files are colocated with source (e.g., `compile.spec.js`)

## TODO: Google Sheets-style Edit Behavior

When implementing row/column/sheet selection, consider that in Google Sheets:
- The focused cell in a selection is not immediately editable (prevents accidental edits)
- Editing is only enabled through explicit actions:
  - Clicking in the formula bar
  - Double-clicking the cell
  - Pressing F2 or Enter
  - Starting to type (replaces content)
- This maintains visual clarity of the selection and separates "selection mode" from "edit mode"
