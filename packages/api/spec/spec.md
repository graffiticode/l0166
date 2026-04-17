<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Graffiticode L0166 Vocabulary

L0166 is an authoring language for interactive spreadsheets. A primary use
case is spreadsheet-based assessment — cells that grade student-entered
values or formulas against an expected answer, optionally with parameterized
inputs that vary per render. L0166 also supports display and worksheet modes
without grading.

This specification documents the dialect-specific functions that extend the
core Graffiticode language for L0166 use cases. The core language
specification, including syntax, semantics, and base library, can be found
here: [Graffiticode Language Specification](./graffiticode-language-spec.html)

## Functions

| Function | Signature | Description |
| :------- | :-------- | :---------- |
| `text`   | `<string string: record>` | Sets text content for a cell |
| `assess` | `<array array: record>` | Defines assessment criteria for a cell |
| `method` | `<string>` | Specifies the assessment method |
| `expected` | `<string>` | Specifies the expected value for assessment |
| `width`  | `<int record: record>` | Sets the width of a column |
| `align`  | `<string record: record>` | Sets the alignment of a column (left, right, center, justify) |
| `cell`   | `<string string: record>` | Defines a single cell data and configuration |
| `cells`  | `<array array: record>` | Defines multiple cells from an array |
| `row`    | `<string record: record>` | Defines a single row configuration |
| `rows`   | `<array array: record>` | Defines multiple rows from an array |
| `column` | `<string string: record>` | Defines a single column configuration |
| `columns`| `<array array: record>` | Defines multiple columns from an array |
| `params` | `<record: record>` | Defines parameters available as cell values |

### text

Sets the text content for a cell.

```
text "Hello World" {...}
```

### assess

Defines assessment criteria for a cell.

```
assess [method "value" expected "10"] {...}
```

### method

Specifies the assessment method type.

```
method "value"
```

### expected

Specifies the expected value for assessment validation. The value can be a
literal string or a spreadsheet formula. When a formula is used (prefixed
with `=`), it is evaluated against the current cell values at scoring time.

```
expected "10"
expected "=A1+C1"
expected "=SUM(A1:A5)"
```

### cell

Defines a single cell content and configuration.

```
cell "A1" text "Hello" {}
cell "A1" text "A1" assess [method "value" expected "10"] {}
```

### cells

Defines multiple cells from an array.

```
cells [
  cell "A1" text "Hello" {},
  cell "B1" text "World" {}
] {...}
```

### row

Defines a single row configuration. The first argument is the row identifier
(a number or `"*"` for all rows).

```
row 1 font-weight "bold" {}
row "*" assess [method "value" expected "actual"] {}
```

### rows

Defines multiple row configurations from an array.

```
rows [
  row 1 font-weight "bold" background-color "#DDDDDD" {},
  row 2 color "#FF0000" {}
] {...}
```

### width

Sets the width of a column in pixels.

```
width 100 {...}
```

### align

Sets the alignment of column content. Valid values are "left", "right", "center", or "justify".

```
align "right" {...}
```

### column

Defines a single column configuration.

```
column "A" width 100 align "right" {}
```

### columns

Defines multiple column configurations from an array.

```
columns [
  column "A" width 100 align "right" {},
  column "B" width 150 align "left" {}
] {...}
```

### params

Defines parameter templates for populating cell values. The argument is a record
mapping cell references to value specifications. Cells reference param values
using `{{key}}` template syntax in their text.

Value specifications:

- **Comma-separated values**: `"Hello, Goodbye"` — one value is randomly selected
- **Numeric range**: `"100..200:50"` — expands to values 100, 150, 200
- **Single value**: `"Fees earned"` — always uses that value

When multiple params are defined, the compiler generates the Cartesian product
of all value combinations (up to a maximum of 249 records).

Simple example with comma-separated values:

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

Example with numeric ranges:

```
columns [
  column A width 200 align "right" {}
  column B width 100 align "right" {}
] cells [
  cell A1 text "{{A1}}" {}
  cell A2 text "{{A2}}" {}
  cell B1 text "{{B1}}" {}
  cell B2 text "{{B2}}" {}
]
params {
  A1: "Fees earned",
  A2: "Office expense",
  B1: "1485000..1585000:200000",
  B2: "325000..425000:25000",
}
{
  v: "0.0.1"
}..
```

## Spreadsheet Formula Functions

The following functions are available for use in cell formulas (prefixed with `=`):

| Function | Syntax | Description |
| :------- | :----- | :---------- |
| `SUM` | `=SUM(range)` | Adds all numeric values in a range |
| `AVERAGE` | `=AVERAGE(range)` | Computes the arithmetic mean of numeric values |
| `ROUND` | `=ROUND(value,places)` | Rounds a number to specified decimal places |
| `IF` | `=IF(condition,true_val,false_val)` | Returns value based on condition |

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

## Program Examples

### Formula-based assessment

Create an addition problem where the expected answer is computed from other
cell values. When used with `params`, each random combination produces a
different correct answer.

```
columns [
  column A width 150 align "center" {}
  column B width 100 align "center" {}
  column C width 150 align "center" {}
] cells [
  cell A1 text "{{A1}}" font-weight "bold" background-color "#FFFACD" {}
  cell B1 text "+" font-weight "bold" {}
  cell C1 text "{{C1}}" font-weight "bold" background-color "#FFFACD" {}
  cell A2 text "What is the sum?" {}
  cell C2 text "" assess [method "value" expected "=A1+C1"] {}
]
params {
  A1: "12, 25, 34, 47",
  C1: "8, 15, 26, 33",
}
{
  v: "0.0.1"
}..
```

### Parameterized assessment with row sorting

Create a 2 by 2 spreadsheet assessment where the rows are sorted to match the
candidate's actual response. Param values populate cells using template syntax
and are also used as expected values for assessment.

```
rows [
  row "*" assess [method "value" expected "actual"] {}
]
columns [
  column A width 100 align "right" {}
  column B width 100 align "left" {}
]
cells [
  cell A1 text "{{A1}}" assess [method "value" expected "{{A1}}"] {}
  cell A2 text "{{A2}}" assess [method "value" expected "{{A2}}"] {}
  cell B1 text "{{B1}}" {}
  cell B2 text "{{B2}}" {}
]
params {
  A1: "100..200:50",
  A2: "1000..2000:500",
  B1: "pigs, chickens, cows",
  B2: "apples, oranges, bananas",
}
{
  v: "0.0.1"
}..
```
