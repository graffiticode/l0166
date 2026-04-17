<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0166 User Guide

Agent-facing guide for authoring interactive spreadsheets through L0166. Read this before composing a `create_item` prompt or an `update_item` modification.

## Overview

L0166 is an authoring language for interactive spreadsheets. A primary use case is spreadsheet-based assessment — cells that grade student-entered values or formulas against an expected answer, optionally with parameterized inputs that vary per render so each student sees a different instance of the same problem. L0166 also supports display and worksheet modes without grading. Input is a natural-language description of a single spreadsheet; output is an L0166 program that renders as a cell grid with text, formatting (fonts, colors, borders, alignment, widths), formulas (SUM, AVERAGE, ROUND, IF, arithmetic like `=A1+C1`), assessment rules, and optional parameters that fill cell values at render time. L0166 is the right tool when the job is "produce one spreadsheet" — a quiz, a problem set, a worksheet, a data table, a parameterized assessment template — and not an activity-builder, a charting tool, or a data-analysis pipeline.

When composing a request, name the layout first (columns, rows, headers), then the cell contents, then any formatting (bold, alignment, background color, borders), then formulas, and finally any grading or parameterization. The translator listens most reliably when the request flows in that order. Describe alignment and formatting at the level they apply — column-level ("right-align column B"), row-level ("row 1 is bold"), or cell-level ("cell A3 has a red border") — because L0166 attaches them at that level in the output. For grading, say "assess cell X expecting Y" or "the student must enter Z" — that triggers the assessment surface.

In scope: cell content and formatting, column/row configuration, spreadsheet formulas, assessment validation, parameterized templates, titled/instructed layouts, multi-section compositions. Out of scope: charts and visualizations, pivot tables, external data imports (CSV, databases), cross-sheet references, macros or scripting, activity-level assembly (stringing multiple spreadsheets together), and host-app embedding — those belong in other Graffiticode languages or in the host runtime that mounts the compiled spreadsheet.

## Modes

L0166 produces one of three output modes per request. Each mode is a normal L0166 program; the difference is which features are populated.

- **`spreadsheet`** — display or worksheet mode. Cells contain fixed text, numbers, or formulas. No grading. Use when the request is "show me a table", "create a worksheet", or anything without student input.
- **`assessment_spreadsheet`** — grading mode. One or more cells carry an `assess` block with a `method` (value-match or formula-match) and an `expected` value. The renderer collects student input and grades against `expected`. Use when the request names a student answer, a correct value, or a validation rule.
- **`parameterized_spreadsheet`** — templated mode. A `params` block supplies values that fill cells via `{{CELL}}` template syntax. Cells display the param value; formulas and assessments can reference param-filled cells. Use when the request names inputs that change per-render (e.g., "params provide the two operands and the student computes the sum").

A single spreadsheet can combine assessment and parameterization — that still counts as `assessment_spreadsheet` or `parameterized_spreadsheet` depending on which surface is the point of the request.

## Vocabulary Cues

Say this to get that:

- **Title / instructions** — top-of-spreadsheet `title "..."` and markdown `instructions \`...\``. Mention them explicitly; they are not added by default.
- **Column** — `column A width 100 align "right" {}`. Configure width in pixels and alignment as `"left" | "center" | "right" | "justify"`.
- **Cell** — `cell A1 text "..." {}`. Reference cells by their spreadsheet address (A1, B3, etc.).
- **Row** — `row 1 font-weight "bold" {}`. Apply bold, background color, or alignment across a whole row.
- **Formula** — any `=` expression in a cell's text: `text "=SUM(A1:A3)"`. Supported functions: SUM, AVERAGE, ROUND, IF, plus arithmetic (`=A1+B1`, `=A1*C1`).
- **Assess / expected** — `assess [method "value" expected "300"] {}` grades a cell. `method "value"` is string/number match; `method "formula"` requires the student to enter a matching formula. `expected` accepts a literal or a formula (prefix `=`); formula-valued `expected` is evaluated at scoring time against current cell values.
- **Params / template syntax** — `params [a1: "42"]` plus `text "{{A1}}"` in a cell renders the param value. Use when the request mentions "parameters", "fill from params", or "template".
- **Formatting keywords** — `font-weight` ("bold"/"normal"), `font-style` ("italic"), `font-size` (px), `color`, `background-color`, `border` ("1px solid #000"), `text-decoration` ("underline"/"strikethrough"), `text-align`, `vertical-align`.
- **Protected** — `protected true` marks a cell as read-only; useful alongside assessed cells to prevent edits to instruction labels.
- **Number format** — "format with two decimals", "display as currency", "thousands separators" — L0166 maps these to the cell's number format.
- **Alternating row colors** — a recognized pattern; say "alternating row colors" or "striped rows" and L0166 applies it across data rows.

## Example Prompts

- *"Create a four-column spreadsheet with a header row (Product, Qty, Unit Price, Line Total), 3 data rows with `=B*C` line totals in column D, and a SUM grand total in D5. Bold the header row and right-align the numeric columns."* → `spreadsheet`
- *"Create a 3 by 3 grid of assessed input cells where the expected answers are 1 through 9, reading left to right, top to bottom."* → `assessment_spreadsheet`
- *"Put values 10, 20, and 30 in A1 through A3. Assess cell A4 expecting the student to enter the formula =SUM(A1:A3)."* → `assessment_spreadsheet`
- *"Create a parameterized spreadsheet where A1 and A2 are filled by params and A3 is an assessed SUM formula cell expecting the correct total."* → `parameterized_spreadsheet`
- *"Create a two-column label/value layout with 4 rows. Column A has bold labels; column B is right-aligned with a light-yellow background. The last row computes a SUM of the rows above."* → `spreadsheet`
- *"Create a quiz spreadsheet with a title, instructions, 5 word-problem rows (problem in column A, blank assessed cell in column B expecting the correct numeric answer), and a bold header row on a light-gray background."* → `assessment_spreadsheet`

## Out of Scope

- **Charts and visualizations** — pie, bar, line charts. L0166 produces cells; charting is a separate language.
- **Pivot tables and aggregations across sheets** — L0166 is one spreadsheet per program; no cross-sheet references.
- **External data imports** — no CSV, database, or API ingestion. Cell values come from the prompt, params, or formulas over existing cells.
- **Macros and scripting** — no user-defined functions or event hooks. Formula coverage is fixed (SUM, AVERAGE, ROUND, IF, arithmetic).
- **Activity-level assembly** — stringing multiple spreadsheets into a sequenced lesson or test belongs in a higher-level tool, not here.
- **Host-app embedding** — React/Vite integration and mounting the rendered spreadsheet in an LMS is handled by the host runtime, not by this language surface.
