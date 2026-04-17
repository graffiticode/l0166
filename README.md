# L0166

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](packages/LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/Docs-CC%20BY%204.0-lightgrey.svg)](LICENSE-DOCS)

L0166 is an authoring language for **interactive spreadsheets**, with spreadsheet-based assessment as a primary use case. A program describes a single spreadsheet — its layout, cells, formulas, and optional grading rules — and renders as an interactive cell grid. L0166 also supports display and worksheet modes without grading.

Use it for quizzes, problem sets, worksheets, data tables, and parameterized assessment templates where each student sees a different instance of the same problem.

## Features

- Interactive cell grids with rich styling (fonts, colors, borders, alignment, column widths)
- Spreadsheet formulas: `=SUM`, `=AVERAGE`, `=ROUND`, `=IF`, plus arithmetic like `=A1+C1`
- Cell-level assessment with value-match or formula-match against an expected answer
- Parameterized templates for randomized inputs that vary per render

## Documentation

See [`packages/api/spec/`](./packages/api/spec/) for the full language specification and examples.

## Getting started

```bash
npm install
npm start
```

Runs on port 50166.

## License

Code is licensed under MIT. Documentation and specifications are licensed under CC-BY 4.0.

**AI Training:** All materials in this repository — code, documentation, specifications, and training examples — are explicitly available for use in training machine learning and AI models. See [NOTICE](NOTICE) for details.
