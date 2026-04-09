<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Dialect L0166 Specific Instructions

L0166 is a Graffiticode dialect for authoring interactive spreadsheets with tabular cell data, cell-level formatting, spreadsheet formulas (SUM, AVERAGE, ROUND, IF), and optional assessment validation of cell values.

Each L0166 program defines a single spreadsheet layout: column widths, individual cell contents with rich formatting, and optionally formulas or assessment rules that validate student-entered cell values.

## Response Requirements

- **IMPORTANT**: Whatever the user request is, the response should always be a complete spreadsheet with all necessary data, formulas, and formatting included.
- **DEFAULT BEHAVIOR**: If no specific instructions are given but table data is present, create a simple spreadsheet that represents the data with appropriate headers and formatting.
- If the user does not explicitly ask for a title and/or instructions then don't include them in the program.

## Program structure

```
title "Title"
instructions `
- Step 1
- Step 2
- Step 3
`
columns [
  column A width 100 {}
]
cells [
  cell A1 text "A1" font-weight "bold" {}
]
{
}..
```

## Validation syntax

The following validates that cell A3 contains "300":

```
cells [
  cell A1 text "100" {}
  cell A2 text "200" {}
  cell A3 text "" assess [method "value" expected "300"] {}
]
```

## Formula-based expected values

The `expected` value in an assessment can be a spreadsheet formula. The formula is evaluated against the current cell values to compute the expected answer. This is useful when the correct answer depends on other cell values, especially with parameterized assessments.

```
cells [
  cell A1 text "{{A1}}" font-weight "bold" {}
  cell B1 text "+" {}
  cell C1 text "{{C1}}" font-weight "bold" {}
  cell A2 text "" assess [method "value" expected "=A1+C1"] {}
]
```

Any spreadsheet formula (SUM, AVERAGE, ROUND, IF, or arithmetic like `=A1+C1`) can be used as an expected value. The formula is evaluated at scoring time using the current cell values.

## Formatting Guidelines

- IMPORTANT: Remember to maintain Graffiticode's core syntax with `let` declarations and `..` endings
- IMPORTANT: Use the following code as a template for all generated code:

```
title ""
instructions `
`
columns [
]
cells [
]
{
  v: "0.0.1"
}..
```

## Available Functions

The following functions are available in L0166 with their specified arity (number of arguments):

### Spreadsheet-specific functions (arity 2):
- `title` - Sets the spreadsheet title
- `instructions` - Sets instructions for the spreadsheet
- `params` - Defines parameter templates for cell population (see Params section below)
- `cells` - Defines cell content and properties
- `rows` - Configures row properties and assessment ordering
- `columns` - Sets column widths and justification
- `cell` - Defines individual cell with properties
- `text` - Sets text content for a cell
- `assess` - Defines assessment rules for validation
- `width` - Sets column width
- `align` - Sets text alignment (left, center, right)
- `background-color` - Sets background color (hex, rgb, rgba, or named colors)
- `font-weight` - Sets font weight (normal, bold, lighter, bolder)
- `font-size` - Sets font size (e.g., "12px", "14pt", "1.2em")
- `font-family` - Sets font family (e.g., "Arial", "Helvetica", "monospace")
- `font-style` - Sets font style (normal, italic, oblique)
- `color` - Sets text color (hex, rgb, rgba, or named colors)
- `text-decoration` - Sets text decoration (none, underline, overline, line-through)
- `border` - Sets cell borders (e.g., "1px solid black" or "top,right,bottom,left")
- `vertical-align` - Sets vertical alignment (top, middle, bottom)
- `format` - Sets format pattern for cell values (#,##0.00, currency, date, etc.)
- `protected` - Sets whether cell is protected from editing
- `column` - Defines column properties
- `row` - Defines properties for a specific row

### Assessment functions (arity 1):
- `method` - Assessment method (value or formula)
- `expected` - Expected value for validation

## Formatting Examples

### Cell Formatting
```
cells [
  cell A1 text "Header"
    font-weight "bold"
    font-size "16px"
    color "#0000FF"
    background-color "#E6F3FF" {}
  cell B2 text "100"
    font-family "monospace"
    text-decoration "underline"
    border "2px solid red" {}
]
```

### Column Formatting
```
columns [
  column A width 150
    font-style "italic"
    align "center" {}
  column B width 100
    background-color "#FFFFCC"
    border "1px solid #666" {}
]
```

### Row Formatting
```
rows [
  row 1 font-weight "bold"
    background-color "#DDDDDD"
    font-size "14px" {}
  row 2 color "#FF0000"
    vertical-align "middle" {}
]
```

### Border Styles
The `border` function accepts two formats:
1. **CSS border string**: `border "1px solid black" {}` - Applies to all sides
2. **Comma-separated sides**: `border "top,bottom" {}` - Applies 2px solid borders to specified sides (top, right, bottom, left, all)

## Formula Function Usage

The following spreadsheet functions are available for use in cell formulas:

### SUM
Adds all numeric values in a range.
```
=SUM(A1:A10)
=SUM(B1,B2,B3)
```

### AVERAGE
Computes the arithmetic mean of numeric values in a range.
```
=AVERAGE(A1:A10)
=AVERAGE(B1,B2,B3)
```

### ROUND
Rounds a number to a specified number of decimal places.
```
=ROUND(A1,2)
```

### IF
Returns one value if a condition is true, another if false.
```
=IF(A1,B1,C1)
```

- IMPORTANT: Use the SUM function when adding or subtracting contiguous numeric cells with a formula
- IMPORTANT: Use the AVERAGE function when computing the mean of contiguous numeric cells

## Params (Parameter Templates)

The `params` function defines parameter templates that populate cell values at runtime. Each time the spreadsheet is loaded, one set of values is randomly selected from the generated combinations.

### Syntax

`params` takes a record where keys are cell references and values are parameter specifications:

```
params {
  A1: "Hello, Goodbye",
}
```

### Cell template syntax

Cells reference param values using `{{key}}` in their text:

```
cell A1 text "{{A1}}" {}
```

At runtime, `{{A1}}` is replaced with the selected param value.

**IMPORTANT**: Only reference params that are defined. A `{{key}}` reference must correspond to a key in the `params` record. Referencing an undefined param will leave the template unresolved.

### Value specifications

- **Comma-separated values**: `"Hello, Goodbye"` — randomly selects one value
- **Numeric range**: `"100..200:50"` — expands to 100, 150, 200 (start..stop:increment)
- **Single value**: `"Fees earned"` — always uses that value

### Multiple params (Cartesian product)

When multiple params are defined, all combinations are generated. For example:

```
params {
  A1: "Hello, Goodbye",
  B1: "10, 20",
}
```

This generates 4 combinations: (Hello, 10), (Hello, 20), (Goodbye, 10), (Goodbye, 20). One is randomly selected each time.

### Complete example

```
columns [
  column A width 100 align "center" {}
  column B width 100 align "center" {}
] cells [
  cell A1 text "{{A1}}" {}
  cell B1 {}
  cell A2 {}
  cell B2 {}
]
params {
  A1: "Hello, Goodbye"
}
{
  v: "0.0.1"
}..
```