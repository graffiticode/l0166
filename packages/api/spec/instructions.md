# Dialect L0165 Specific Instructions

This dialect is used for generating spreadsheet based assessments.

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
  cell A3 text: "" assess [method "value" expected "300"] {}
]
```

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
- `params` - Defines parameter templates for cell population
- `cells` - Defines cell content and properties
- `rows` - Configures row properties and assessment ordering
- `columns` - Sets column widths and justification
- `cell` - Defines individual cell with properties
- `text` - Sets text content for a cell
- `assess` - Defines assessment rules for validation
- `width` - Sets column width
- `align` - Sets text alignment (left, center, right)
- `background-color` - Sets background color
- `font-weight` - Sets font weight (normal, bold, lighter, bolder)
- `format` - Sets format pattern for cell values (#,##0.00, currency, date, etc.)
- `protected` - Sets whether cell is protected from editing
- `column` - Defines column properties

### Assessment functions (arity 1):
- `method` - Assessment method (value or formula)
- `expected` - Expected value for validation

## Formula Function Usage

- IMPORTANT: Use the SUM function when adding or subtracting contiguous numeric cells with a formula