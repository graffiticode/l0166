<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# L0166 Usage Guide

Welcome to the L0166 language guide, where you'll learn how to create and customize spreadsheets using natural language requests. This language is accessible through the Graffiticode MCP tool and console, allowing both AI agents and human users to generate structured spreadsheet documents with ease.

## What You Can Create with L0166

### Basic Spreadsheet Structures

L0166 allows you to create spreadsheets with various structural elements:

- **Single Cells and Grids**: You can create spreadsheets with a single empty cell or a grid of any size. For example, "Create a spreadsheet with a single empty cell" or "Make a 2 by 2 empty grid."
- **Titled Spreadsheets**: Add titles to your spreadsheets for clarity. For instance, "Create a spreadsheet with the title 'Monthly Report' and an empty grid."
- **Headers and Lists**: Design spreadsheets with headers and lists. Requests like "Create a spreadsheet with two columns. Column A header is 'Item' and column B header is 'Price'. Make both headers bold" are supported.

### Column Configuration

Customize the appearance and behavior of columns:

- **Width and Alignment**: Specify column widths and alignments. For example, "Make a spreadsheet with one column that is 200 pixels wide" or "Create a spreadsheet with a column B that is right-aligned for displaying dollar amounts."
- **Styling**: Apply styles such as bold, italic, or background colors to columns. Requests like "Make a spreadsheet with column A styled in italic" are possible.

### Cell Text and Content

Populate cells with various types of content:

- **Text and Numbers**: Enter text or numeric values into cells. For instance, "Create a spreadsheet with three cells in column A containing the numbers 10, 20, and 30."
- **Formulas**: Use simple formulas like SUM and AVERAGE. For example, "Create a spreadsheet with values 10, 20, 30, 40, 50 in cells A1 through A5, and put a SUM formula in A6 that totals them."

### Cell and Row Formatting

Enhance the visual presentation of your spreadsheets:

- **Cell Formatting**: Apply styles such as bold, italic, underline, or background colors to individual cells. For example, "Make a cell with red text that says 'Warning'."
- **Row Formatting**: Format entire rows with styles like bold text or background colors. Requests like "Create a spreadsheet where row 1 is bold" are supported.

### Assessment and Validation

Incorporate assessment features to validate user input:

- **Input Validation**: Create cells that expect specific inputs and validate them. For example, "Create a cell where the student must enter the value 100. Validate their answer."
- **Assessed Formulas**: Use formulas in assessed cells to check for correct calculations. For instance, "Put values 10, 20, and 30 in A1 through A3. Assess cell A4 expecting the student to enter the formula =SUM(A1:A3)."

### Parameterized Templates

Use parameters to create dynamic spreadsheets:

- **Parameterized Cells**: Populate cells with values provided through parameters. For example, "Create a spreadsheet with a parameter that populates cell A1 with 'Hello'."
- **Template Syntax**: Use template syntax to reference parameter values in cells. Requests like "Create a parameterized spreadsheet where A1 gets the number 42 and A2 gets 100 from parameters" are supported.

### Complex Structural Compositions

Design intricate spreadsheet layouts:

- **Multi-Section Layouts**: Create spreadsheets with multiple sections, headers, and totals. For instance, "Create a four-column spreadsheet with a header row, 4 data rows, and a SUM total row."
- **Label/Value Layouts**: Design spreadsheets with label and value columns. Requests like "Create a two-column label/value layout with 4 rows" are possible.

### Feature Combinations

Combine multiple features for advanced spreadsheet designs:

- **Comprehensive Layouts**: Combine titles, instructions, custom column widths, bold headers, and more. For example, "Create a spreadsheet with a title, instructions, 4 columns with custom widths, a bold header row with background color, 4 data rows with alternating row colors, AVERAGE formulas in the last column, and assessed blank cells for missing values."

## Iterating and Refining Your Spreadsheets

L0166 supports iteration through the `update_item` feature, allowing you to refine and adjust your spreadsheets based on feedback or new requirements. You can modify existing elements, add new ones, or change styles and content as needed.

## Limitations and Cross-References

While L0166 is powerful for creating structured spreadsheets, it does not support advanced data analysis, chart creation, or external data integration. For these capabilities, consider using other Graffiticode languages such as L0200 for data analysis or L0300 for visualization.

Explore the full potential of L0166 to create tailored spreadsheet solutions that meet your specific needs.