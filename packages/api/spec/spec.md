# Graffiticode L0166 Vocabulary

This specification documents dialect-specific functions available in the
**L0166** language of Graffiticode. These functions extend the core language
with additional functionality tailored to L0166 use cases.

The core language specification including the definition of its syntax,
semantics and base library can be found here:
[Graffiticode Language Specification](./graffiticode-language-spec.html)

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
| `rows`   | `<record record: record>` | Defines row data and configurations |
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

Specifies the expected value for assessment validation.

```
expected "10"
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

### rows

Defines row attributes.

```
rows {...} {...}
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

Defines parameter sets used to populate cells.

```
params {
  A1: "Fees earned",
  A2: "Office expense",
  A3: "Miscellaneous expense",
  A4: "Salary and wage expense",
  B1: "1485000..1585000:200000",
  B2: "325000..425000:25000",
  B3: "26000..30000:2000",
  B4: "875000..975000:50000",
}
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

Create a 2 by 2 spreadsheet assessment where the rows are sorted to match the
candidate's actual response.

```
rows {
  "*": {
    assess: {
      index: "B",
      order: "actual", | "expected", "asc", "desc"
    }
  }
}
columns {
  A: {
    width: 100,
    align: "right",
  },
  B: {
    width: 100,
    align: "left",
  },
}
cells {
  A1: {
    text: "{{A1}}",
    attrs: {
      assess: {
        method: "value",
        expected: "{{A1}}"
      }
    },
  },
  A2: {
    text: "{{A2}}",
    attrs: {
      assess: {
        method: "value",
        expected: "{{A2}}"
      }
    },
  },
  B1: {
    text: "{{B1}}",
  },
  B2: {
    text: "{{B2}}",
  },
}
params {
  A1: "100..200: 50",
  A2: "1000..2000: 500",
  B1: "pigs, chickens, cows",
  B2: "apples, oranges, bananas",
}{}..
```
