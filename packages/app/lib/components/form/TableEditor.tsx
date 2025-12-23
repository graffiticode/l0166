/*
  TODO
  [ ] Handle single and double click and tab in cells
  [x] Sort dependency tree & check for cycles
  [ ] Make expanderBuilders a module parameter
  [ ] BUG fix updating cells when clicking on headers
*/

import assert from "assert";
import React, { useState, useEffect, useRef } from 'react'; React;

import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-menu/style/menu.css';
import 'prosemirror-example-setup/style/style.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import "prosemirror-tables/style/tables.css";

import { EditorView } from 'prosemirror-view';
import {
  EditorState,
  TextSelection,
} from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { schema as baseSchema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';

import {
//   addColumnAfter,
//   addColumnBefore,
//   deleteColumn,
//   addRowAfter,
//   addRowBefore,
//   deleteRow,
//   mergeCells,
//   splitCell,
//   setCellAttr,
//   toggleHeaderRow,
//   toggleHeaderColumn,
//   toggleHeaderCell,
//   goToNextCell,
//   deleteTable,
//   findCell,
  TableMap,
} from "prosemirror-tables";
import {
  tableEditing,
  columnResizing,
  tableNodes,
  fixTables,
//  CellSelection,
} from "prosemirror-tables";

import { baseKeymap } from "prosemirror-commands"
import { undo, redo, history } from "prosemirror-history";
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from "prosemirror-view";
import ReactDOM from 'react-dom/client';
import { MenuView } from './MenuView';
import { ProtectedCellTooltip } from './ProtectedCellTooltip';
//import { debounce } from "lodash";

import { TransLaTeX, spreadsheetExpanders } from "@graffiticode/translatex";
import { evalRules, cellNameRules, formatRules, normalizeRules } from './translatex-rules.js';

// Removed unused Decimal import and isValidDecimal function

const isQuoteChar = c => (
  ["\"", "'", "`"].includes(c)
);

const toUpperCase = text => {
  // Convert to string if it's not already
  if (typeof text !== 'string') {
    text = text == null ? '' : String(text);
  }
  return text && text.split("").reduce((acc, c) => ({
    inString: isQuoteChar(c) ? !acc.inString : acc.inString,
    text: acc.text + (acc.inString && c || c.toUpperCase()),
  }), {inString: false, text: ""}).text || text;
}

const isNumeric = text => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return !isNaN(Number(trimmed)) && !isNaN(parseFloat(trimmed));
}

const isDateLike = text => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  // Check for common date patterns
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // MM/DD/YYYY or M/D/YY
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,   // MM-DD-YYYY or M-D-YY
    /^\d{4}-\d{1,2}-\d{1,2}$/,     // YYYY-MM-DD
    /^\d{1,2}\/\d{1,2}$/,          // MM/DD
    /^\d{1,2}-\d{1,2}$/,           // MM-DD
  ];
  return datePatterns.some(pattern => pattern.test(trimmed)) && !isNaN(Date.parse(trimmed));
}

// Helper functions for range selection
const columnToNumber = (col) => {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return num;
};

const numberToColumn = (num) => {
  let col = '';
  while (num > 0) {
    num--;
    col = String.fromCharCode('A'.charCodeAt(0) + (num % 26)) + col;
    num = Math.floor(num / 26);
  }
  return col;
};

const getColumnRange = (startCol, endCol) => {
  const start = columnToNumber(startCol);
  const end = columnToNumber(endCol);
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const columns = [];
  for (let i = min; i <= max; i++) {
    columns.push(numberToColumn(i));
  }
  return columns;
};

const getRowRange = (startRow, endRow) => {
  const start = parseInt(startRow);
  const end = parseInt(endRow);
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const rows = [];
  for (let i = min; i <= max; i++) {
    rows.push(String(i));
  }
  return rows;
};

const getCellRange = (startCell, endCell) => {
  // Parse cell names (e.g., "B2" -> col: "B", row: "2")
  const parseCell = (cell) => {
    const match = cell.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return { col: match[1], row: match[2] };
  };

  const start = parseCell(startCell);
  const end = parseCell(endCell);
  if (!start || !end) return [];

  const columns = getColumnRange(start.col, end.col);
  const rows = getRowRange(start.row, end.row);

  const cells = [];
  for (const row of rows) {
    for (const col of columns) {
      cells.push(col + row);
    }
  }
  return cells;
};

const wrapPlainTextInLatex = text => {
  // Convert to string if it's not already
  if (typeof text !== 'string') {
    text = text == null ? '' : String(text);
  }

  if (!text || text.length === 0) {
    return text;
  }
  // If it's a formula (starts with =), don't wrap
  if (text.indexOf("=") === 0) {
    return text;
  }
  // If it's already wrapped in \text{}, don't double wrap
  if (text.trim().startsWith("\\text{") && text.trim().endsWith("}")) {
    return text;
  }
  // If it contains LaTeX commands, don't wrap to avoid breaking them
  if (text.includes("\\")) {
    return text;
  }

  // Check if text has numeric/date prefix with additional text
  // Examples: "35% of total", "100 items", "2024 forecast"
  const trimmed = text.trim();

  // Check for percentage with additional text
  if (/%\s+\S/.test(trimmed)) {
    // Has percentage followed by more text, wrap it
    return `\\text{${text}}`;
  }

  // Check for number followed by text (not just units)
  // Match: number (with optional decimals/commas) followed by space and text
  const numberWithTextPattern = /^[\d,.$€£¥₹₽-]+\s+[a-zA-Z]{4,}/;
  if (numberWithTextPattern.test(trimmed)) {
    // Has number followed by significant text (4+ chars to avoid units), wrap it
    return `\\text{${text}}`;
  }

  // Check for date-like pattern followed by text
  const dateWithTextPattern = /^(\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+\S/;
  if (dateWithTextPattern.test(trimmed)) {
    // Has date followed by text, wrap it
    return `\\text{${text}}`;
  }

  // If it's a pure number, don't wrap (Excel can format numbers)
  if (isNumeric(text)) {
    return text;
  }
  // If it's a pure date, don't wrap (Excel can format dates)
  if (isDateLike(text)) {
    return text;
  }
  // Wrap plain text in \text{}
  return `\\text{${text}}`;
}

/**
 * Normalizes number input from various formats (e.g., "1,234.56", "$1234.56", "1.234,56")
 * into a standard numeric value
 * @param {string} text - The user input text
 * @returns {number|null} - The normalized number or null if not a valid number
 */
const normalizeNumberInput = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }
  let normalized = text.trim();
  if (!normalized) {
    return null;
  }

  // Check if this looks like text with a numeric prefix
  // e.g., "35% of total", "100 items", etc.
  // These should be treated as text, not numbers
  if (/%\s+\S/.test(normalized)) {
    // Has percentage followed by more text
    return null;
  }

  // Check for number followed by non-unit text
  const numberWithTextPattern = /^[\d,.$€£¥₹₽-]+\s+[a-zA-Z]{4,}/;
  if (numberWithTextPattern.test(normalized)) {
    // Has number followed by significant text (not just units)
    return null;
  }

  // Save original for parentheses check before removing them
  const originalNormalized = normalized;
  // Remove currency symbols
  const currencySymbols = ['$', '€', '£', '¥', '₹', '₽', 'R$', 'C$', 'A$', 'NZ$', 'HK$', 'S$'];
  currencySymbols.forEach(symbol => {
    // Escape special regex characters
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedSymbol, 'g'), '');
  });
  // Handle percentage (convert to decimal)
  const isPercentage = normalized.includes('%');
  normalized = normalized.replace(/%/g, '');
  // Handle negative numbers in parentheses e.g., (1,234.56) or ($1,234.56)
  const isNegativeParentheses = /^\s*\([^)]+\)\s*$/.test(originalNormalized) &&
        /\d/.test(originalNormalized);
  if (isNegativeParentheses) {
    normalized = normalized.replace(/[()]/g, '');
  }
  // Remove spaces
  normalized = normalized.replace(/\s/g, '');
  // Handle negative sign
  const isNegative = normalized.startsWith('-');
  if (isNegative) {
    normalized = normalized.substring(1);
  }
  // Determine decimal separator by analyzing the pattern
  const commaCount = (normalized.match(/,/g) || []).length;
  const periodCount = (normalized.match(/\./g) || []).length;
  const lastComma = normalized.lastIndexOf(',');
  const lastPeriod = normalized.lastIndexOf('.');
  let cleanedNumber;
  if (commaCount === 0 && periodCount === 0) {
    // No separators, just a plain number
    cleanedNumber = normalized;
  } else if (commaCount === 0 && periodCount === 1) {
    // Only one period, it's a decimal separator
    cleanedNumber = normalized;
  } else if (commaCount === 1 && periodCount === 0) {
    // Only one comma, check if it's likely a decimal
    const afterComma = normalized.substring(lastComma + 1);
    if (afterComma.length === 3 && normalized.length > 4) {
      // Likely thousand separator (e.g., "1,234")
      cleanedNumber = normalized.replace(/,/g, '');
    } else {
      // Likely decimal separator (e.g., "1,23" or "123,45")
      cleanedNumber = normalized.replace(',', '.');
    }
  } else if (lastComma > lastPeriod) {
    // Comma is after period, European format (e.g., "1.234,56")
    cleanedNumber = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    // Period is after comma, US format (e.g., "1,234.56")
    cleanedNumber = normalized.replace(/,/g, '');
  }
  // Check if the result is a valid number
  const num = parseFloat(cleanedNumber);
  if (isNaN(num)) {
    return null;
  }
  // Apply modifiers
  let result = num;
  // Apply negative
  if (isNegative || isNegativeParentheses) {
    result = -Math.abs(result);
  }
  // Apply percentage conversion
  if (isPercentage) {
    result = result / 100;
  }
  return result;
};

/**
 * Converts a Date object to Excel serial number
 * Uses the 1904 date system (Mac Excel) to avoid the 1900 leap year bug
 * Excel serial dates start from January 1, 1904 as day 1
 * @param {Date} date - The date to convert
 * @returns {number} - The Excel serial number
 */
const dateToSerial = (date) => {
  const excelEpoch = new Date(1904, 0, 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceEpoch = Math.floor((date.getTime() - excelEpoch.getTime()) / msPerDay);
  return daysSinceEpoch + 1;
};

/**
 * Normalizes date input from various formats into a serial number
 * @param {string} text - The user input text
 * @returns {number|null} - The date serial number or null if not a valid date
 */
const normalizeDateInput = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  // Handle relative dates
  const today = new Date();
  const lowerText = trimmed.toLowerCase();
  if (lowerText === 'today') {
    return dateToSerial(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  }
  if (lowerText === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return dateToSerial(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
  }
  if (lowerText === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return dateToSerial(new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));
  }
  // Check if it's just a number (not a date)
  // This includes integers, decimals, and negative numbers
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  // Check if it looks like a number with thousand separators or currency
  // e.g., "1,234" or "$1,234.56" or "€1.234,56"
  const currencyPattern = /^[$€£¥₹₽]?\s*-?\d{1,3}([,.]?\d{3})*([,.]\d+)?$|^-?\d{1,3}([,.]?\d{3})*([,.]\d+)?\s*[$€£¥₹₽%]?$/;
  if (currencyPattern.test(trimmed)) {
    return null;
  }
  // Try to parse various date formats
  // First, try native Date parsing for ISO and common formats
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return dateToSerial(new Date(parsed));
  }
  // Handle MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY
  const usDatePattern = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/;
  const usMatch = trimmed.match(usDatePattern);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return dateToSerial(new Date(year, month - 1, day));
    }
  }
  // Handle DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (European format)
  // Note: This could conflict with US format for ambiguous dates like 01/02/2023
  // You may want to make this configurable based on locale
  const euDatePattern = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/;
  const euMatch = trimmed.match(euDatePattern);
  if (euMatch) {
    const day = parseInt(euMatch[1], 10);
    const month = parseInt(euMatch[2], 10);
    const year = parseInt(euMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && day > 12) {
      // Only use EU format if day > 12 to avoid ambiguity
      return dateToSerial(new Date(year, month - 1, day));
    }
  }
  // Handle MM/DD or MM-DD (current year implied)
  const partialDatePattern = /^(\d{1,2})[\/\-](\d{1,2})$/;
  const partialMatch = trimmed.match(partialDatePattern);
  if (partialMatch) {
    const month = parseInt(partialMatch[1], 10);
    const day = parseInt(partialMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return dateToSerial(new Date(today.getFullYear(), month - 1, day));
    }
  }
  // Handle YYYY-MM-DD (ISO format)
  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return dateToSerial(new Date(year, month - 1, day));
    }
  }
  return null;
};

const normalizeValue = value => {
  // Handle non-string values (numbers, dates as serial numbers)
  if (typeof value === 'number') {
    return [value];
  }

  // Handle null/undefined
  if (value == null) {
    return [value];
  }

  // Convert to string for processing
  const text = String(value);
  let result = [text];

  try {
    const options = {
      // allowThousandsSeparator: true,
      keepTextWhitespace: true,
      ...normalizeRules,
    };
    if (text && text.length > 0) {
      const processedText = text.indexOf("=") === 0 ? toUpperCase(text) : wrapPlainTextInLatex(text);
      const translate = TransLaTeX.buildTranslator(options, spreadsheetExpanders);
      translate(processedText, (err, val) => {
        if (err && err.length) {
          console.error(err);
        }
        result = text.indexOf("=") === 0 ? val.split(",") : [val];
      });
    }
  } catch (x) {
    console.log("parse error: " + x.stack);
  }
  return result;
};

const equivFormula = (actual, expected) => {
  const normalizedActual = normalizeValue(actual);
  const normalizedExpected = normalizeValue(expected);

  // Check if arrays have same length
  if (normalizedActual.length !== normalizedExpected.length) {
    return false;
  }

  // Simple string comparison for formula text
  return normalizedActual.every((val, index) => {
    const expectedVal = normalizedExpected[index];
    // Just compare as strings since we're comparing formula text
    return val === expectedVal;
  });
};

const equivValue = (actual, expected, actualType, expectedType) => {
  // First check type compatibility
  if (actualType && expectedType && actualType !== expectedType) {
    return false;
  }

  // Both values should be strings now, so direct comparison works
  return actual !== undefined && actual === expected;
};

const scoreCell = ({ method, expected, points = 1 }, {val, formula, type} = {val:undefined, formula:undefined, type:undefined}) => {
  // For assessment by value, also consider the type
  if (method === "value") {
    // Parse expected value to determine its type if not provided
    let expectedType = 'text';
    let expectedVal = expected;

    if (expected != null) {
      const expectedStr = String(expected);
      // Check if it's a date
      const normalizedDate = normalizeDateInput(expectedStr);
      if (normalizedDate) {
        expectedType = 'date';
        // Store as string to match how we store val
        expectedVal = String(normalizedDate);
      }
      // Check if it's a number
      else {
        const normalizedNumber = normalizeNumberInput(expectedStr);
        if (normalizedNumber !== null) {
          expectedType = 'number';
          // Store as string to match how we store val
          expectedVal = String(normalizedNumber);
        }
      }
    }

    // Compare values and types (both are strings now)
    if (equivValue(val, expectedVal, type, expectedType)) {
      return { points, isValid: true };
    }
  }
  // For formula assessment, just compare the formula text
  else if (method === "formula" && equivFormula(formula, expected)) {
    return { points, isValid: true };
  }

  return { points: 0, isValid: false };
};

const buildMenuPlugin = (formState) => {
  let currentHideMenu = formState.data.interaction?.hideMenu || false;
  return new Plugin({
    view(editorView) {
      const menuDiv = document.createElement('div');
      const root = ReactDOM.createRoot(menuDiv!);
      editorView.dom.parentNode.insertBefore(menuDiv, editorView.dom);
      const update = () => {
        const hideMenu = formState.data.interaction?.hideMenu || false;
        root.render(
          <MenuView
            className=""
            editorView={editorView}
            hideMenu={hideMenu}
          />,
        );
      };
      update();
      return {
        update() {
          // Check if hideMenu value has changed
          const hideMenu = formState.data.interaction?.hideMenu || false;
          if (hideMenu !== currentHideMenu) {
            currentHideMenu = hideMenu;
            root.render(
              <MenuView
                className=""
                editorView={editorView}
                hideMenu={hideMenu}
              />,
            );
          }
        },
        destroy() {
          root.unmount();
        }
      };
    }
  });
};

const applyDecoration = ({ doc, cells }) => {
  const decorations = [];
  cells.forEach(({ from, to, color, textColor, fontWeight, border, borderClass }) => {
    decorations.push(Decoration.node(from, to, {
      style: `
        background-color: ${color};
        ${textColor ? `color: ${textColor};` : ''}
        ${fontWeight ? `font-weight: ${fontWeight};` : ''}
        ${border};
      `,
      class: borderClass || ""
    }));
  });
  return DecorationSet.create(doc, decorations);
};

const getCellColor = (cell) => {
  const { row, col, name, background, 'background-color': bgColorKebab, backgroundColor: bgColorCamel, lastFocusedCell, score } = cell;
  const backgroundColor = bgColorKebab || bgColorCamel; // Support both kebab-case and camelCase

  // Don't apply colors to header cells (row 1 or column 1)
  if (row <= 1 || col <= 1) {
    return null;
  }

  return score !== undefined && name !== lastFocusedCell && (
    score.isValid === true &&
      "#efe" ||
      "#fee"
  ) || backgroundColor || background || null;
};

const getCellValue = cell => (
  cell.text || cell.val
);

const getExpectedCellValue = cell => (
  cell?.text || cell?.attrs?.assess?.expected
);

const getActualOrder = ({cells, primaryColumn}) => {
  const primaryColumnCellNames = (
    Object.keys(cells).sort((a, b) => +a.slice(1) - +b.slice(1)).map(name => (
      name.slice(0, 1) === primaryColumn && name || null
    )).filter(x => x !== null)
  );
  const order = primaryColumnCellNames.map(
    name => getCellValue(cells[name]) || null
  );
  const seen = new Set();
  return order.map(item => {
    // Remove dups.
    if (seen.has(item)) {
      return null;
    }
    seen.add(item);
    return item;
  }).filter(x => x !== null);
}

const sortAssessRowsToMatchActual = ({ cells, region }) => {
  const { primaryColumn, rows } = region;
  const order = getActualOrder({cells, primaryColumn});
  const dataMap = new Map(rows.map(row => [getExpectedCellValue(row[primaryColumn]), row]));
  const sortedRows = order.map(id => (id !== null ? dataMap.get(id) || null : null));
  return sortedRows;
}

const getCellsValidationFromRegionValidation = ({ cells, region }) => {
  const rows = (
    region?.order === "actual" &&
      sortAssessRowsToMatchActual({cells, region}) as [{id}] ||
      region?.rows || []
  );
  assert(region, "getCellsValidationFromRegionValidation() missing region value");
  const cellsValidation = rows.reduce((cells, row, index) => (
    // TODO mark holes as errors.
    index = row?.id || index + 1,
    row && Object.keys(row).forEach(key => (
      row[key]?.assess && (cells[key + index] = row[key])
    )),
    cells
  ), {}) || {};
  return cellsValidation;
};

const getRegionValidations = ({ cells, validation }) => {
  const regions = validation.regions || validation.ranges; // ranges for backward compat
  const regionName = Object.keys(regions).find(key => (
    key    // return the first region name for now.
  ));
  // TODO Handle multiple regions. Split cells by region.
  return [{
    region: regions[regionName] || {},
    cells,
  }];
};

// Determine if a position is within a header cell
const isPosInHeader = (state, pos) => {
  if (pos === null) return false;
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "table_header") {
      return true;
    }
  }
  return false;
};

// Function to find the next non-header cell in the table
const findNextDataCell = (state, dir) => {
  const { doc, selection } = state;
  const $pos = selection.$anchor;
  const table = findTable($pos);

  if (!table) return null;

  const tableNode = doc.nodeAt(table.pos);
  const tableMap = TableMap.get(tableNode);
  const width = tableMap.width;
  const height = tableMap.height;

  // Get current cell position within the table
  const cellPos = $pos.pos - table.pos - 1;

  // Find the map index that contains our position
  let currentMapIndex = -1;
  for (let i = 0; i < tableMap.map.length; i++) {
    if (tableMap.map[i] <= cellPos && (i === tableMap.map.length - 1 || tableMap.map[i + 1] > cellPos)) {
      currentMapIndex = i;
      break;
    }
  }

  if (currentMapIndex === -1) {
    // Fallback to the first data cell if we can't determine current position
    return tableMap.map[width + 1] + table.pos + 1; // B2 cell (row 1, col 1)
  }

  // Calculate row and column
  const row = Math.floor(currentMapIndex / width);
  const col = currentMapIndex % width;

  // Determine the next position based on direction
  if (dir > 0) { // Forward (Tab, Right, Down)
    // Try to find next cell in the same row
    for (let c = col + 1; c < width; c++) {
      const nextIndex = row * width + c;

      // Skip if it's a header cell (first row or first column)
      if (row > 0 && c > 0 && nextIndex < tableMap.map.length) {
        return tableMap.map[nextIndex] + table.pos + 1;
      }
    }

    // If we reached the end of the row, go to the next row
    for (let r = row + 1; r < height; r++) {
      // Start from first non-header column (col 1, which is B)
      for (let c = 1; c < width; c++) {
        const nextIndex = r * width + c;

        // Skip if it's a header cell (first row or first column)
        if (r > 0 && c > 0 && nextIndex < tableMap.map.length) {
          return tableMap.map[nextIndex] + table.pos + 1;
        }
      }
    }

    // If we're at the last cell, wrap around to the first data cell
    return tableMap.map[width + 1] + table.pos + 1; // B2 (row 1, col 1)

  } else { // Backward (Shift-Tab, Left, Up)
    // Try to find previous cell in the same row
    for (let c = col - 1; c > 0; c--) {
      const nextIndex = row * width + c;

      // Skip if it's a header cell (first row or first column)
      if (row > 0 && c > 0 && nextIndex < tableMap.map.length) {
        return tableMap.map[nextIndex] + table.pos + 1;
      }
    }

    // If we reached the start of the row, go to the previous row
    for (let r = row - 1; r > 0; r--) {
      // Go from right to left for previous row
      for (let c = width - 1; c > 0; c--) {
        const nextIndex = r * width + c;

        // Skip if it's a header cell (first row or first column)
        if (r > 0 && c > 0 && nextIndex < tableMap.map.length) {
          return tableMap.map[nextIndex] + table.pos + 1;
        }
      }
    }

    // If we're at the first cell, wrap around to the last data cell
    for (let r = height - 1; r > 0; r--) {
      for (let c = width - 1; c > 0; c--) {
        const nextIndex = r * width + c;
        if (nextIndex < tableMap.map.length) {
          return tableMap.map[nextIndex] + table.pos + 1;
        }
      }
    }

    // Fallback to the last valid cell
    return tableMap.map[tableMap.map.length - 1] + table.pos + 1;
  }
};

// Skip headers in navigation
const skipHeadersGoToNextCell = dir => (state, dispatch) => {
  // Find the next non-header cell position
  const nextPos = findNextDataCell(state, dir);

  if (nextPos !== null && dispatch) {
    // Create a text selection at the next position
    const tr = state.tr;
    const doc = tr.doc;
    const $nextPos = doc.resolve(nextPos);
    const selection = TextSelection.near($nextPos);

    // Update the selection and dispatch the transaction
    dispatch(tr.setSelection(selection));

    return true;
  }

  return false;
};


export const getCellsValidation = ({ cells, validation }) => {
  const regionValidations = getRegionValidations({cells, validation});
  const cellsValidations = regionValidations.map(regionValidation => (
    getCellsValidationFromRegionValidation(regionValidation)
  ));
  return cellsValidations[0];
};

export const scoreCells = ({ cells, validation }) => {
  const cellsValidation = getCellsValidation({cells, validation});
  return Object.keys(cellsValidation).reduce((cells, cellName) => (
    {
      ...cells,
      [cellName]: cells[cellName] && {
        ...cells[cellName],
        score: scoreCell(cellsValidation[cellName].assess, cells[cellName]),
      } || undefined,
    }
  ), cells);
};

const applyModelRules = (cellExprs, state, value, validation, formState) => {
  const cells = getCells(cellExprs, state);
  const scoredCells = scoreCells({ cells: value.cells, validation });
  const { doc, selection } = state;
  const { lastFocusedCell } = value;
  const focus = formState?.data?.focus;

  // Multiply first row and first column values and compare to body values.
  let cellColors = [];
  let cellTextColors = [];
  let cellFontWeights = [];
  cells.forEach(cell => {
    let color = getCellColor({
      ...cell,
      lastFocusedCell,
      score: scoredCells[cell.name]?.score,
    });
    let textColor = null;
    let fontWeight = null;

    // Set default text color and font weight for headers
    if (cell.row === 1 || cell.col === 1) {
      textColor = "#5f6368"; // Default Google Sheets gray for headers
      fontWeight = "400"; // Normal weight for headers
    }

    // Apply highlighting based on focus type
    if (focus) {
      // Check if this is a header and apply dark blue when selected
      if (cell.row === 1 && cell.col > 1) {
        // Column header (A0, B0, C0, etc.)
        const cellColumn = cell.name.match(/^([A-Z]+)/)?.[1];
        const selectedColumns = focus?.columns || (focus?.name ? [focus?.name] : []);
        if (focus?.type === "column" && (cellColumn === focus?.name || selectedColumns.includes(cellColumn))) {
          color = "#1a73e8"; // Google Sheets selected header blue
          textColor = "#ffffff"; // White text for selected header
          fontWeight = "600"; // Semibold weight when selected
        } else if (focus.type === "sheet") {
          color = "#1a73e8"; // Google Sheets selected header blue for all column headers
          textColor = "#ffffff"; // White text for selected header
          fontWeight = "600"; // Semibold weight when selected
        } else {
          // Unselected column header
          textColor = "#5f6368"; // Google Sheets gray text for unselected headers
          fontWeight = "400"; // Normal weight for unselected headers
        }
      } else if (cell.row > 1 && cell.col === 1) {
        // Row header (_1, _2, _3, etc.)
        const cellRow = cell.name.match(/(\d+)$/)?.[1];
        const selectedRows = focus?.rows || (focus?.name ? [focus?.name] : []);
        if (focus.type === "row" && (cellRow === focus.name || selectedRows.includes(cellRow))) {
          color = "#1a73e8"; // Google Sheets selected header blue
          textColor = "#ffffff"; // White text for selected header
          fontWeight = "600"; // Semibold weight when selected
        } else if (focus.type === "sheet") {
          color = "#1a73e8"; // Google Sheets selected header blue for all row headers
          textColor = "#ffffff"; // White text for selected header
          fontWeight = "600"; // Semibold weight when selected
        } else {
          // Unselected row header
          textColor = "#5f6368"; // Google Sheets gray text for unselected headers
          fontWeight = "400"; // Normal weight for unselected headers
        }
      } else if (cell.row === 1 && cell.col === 1) {
        // Top-left corner header (_0)
        if (focus.type === "sheet") {
          color = "#1a73e8"; // Google Sheets selected header blue
          textColor = "#ffffff"; // White text for selected header
          fontWeight = "600"; // Semibold weight when selected
        } else {
          // Unselected top-left corner
          textColor = "#5f6368"; // Google Sheets gray text for unselected headers
          fontWeight = "400"; // Normal weight for unselected headers
        }
      }
      // For data cells, apply light blue highlight
      else if (cell.row > 0 && cell.col > 0) {
        // Check if this cell currently has the selection/cursor
        const isCellSelected = selection.anchor > cell.from && selection.anchor < cell.to;

        if (!isCellSelected) {
          // Only apply highlighting if this cell does NOT have the cursor
          if (focus.type === "sheet") {
            // Highlight all data cells for sheet focus
            color = "#e6f3ff"; // Light blue for entire sheet
          } else if (focus.type === "column") {
            // Check if this cell is in any of the focused columns
            const cellColumn = cell.name.match(/^([A-Z]+)/)?.[1];
            const selectedColumns = focus?.columns || (focus?.name ? [focus?.name] : []);
            if (cellColumn === focus?.name || selectedColumns.includes(cellColumn)) {
              color = "#e6f3ff"; // Light blue for focused column
            }
          } else if (focus.type === "row") {
            // Check if this cell is in any of the focused rows
            const cellRow = cell.name.match(/(\d+)$/)?.[1];
            const selectedRows = focus?.rows || (focus?.name ? [focus?.name] : []);
            if (cellRow === focus.name || selectedRows.includes(cellRow)) {
              color = "#e6f3ff"; // Light blue for focused rows
            }
          } else if (focus.type === "cell") {
            // Check if this cell is in the selection (either range or multiple individual cells)
            // First check if we have a cells array
            if (focus.cells && focus.cells.includes(cell.name)) {
              color = "#e6f3ff"; // Light blue for selected cells
            } else if (focus.name && focus.name.includes(',')) {
              // For comma-separated list of cells
              const selectedCells = focus.name.split(',').map(c => c.trim());
              if (selectedCells.includes(cell.name)) {
                color = "#e6f3ff"; // Light blue for selected cells
              }
            } else if (focus.name === cell.name) {
              // Single cell selection
              color = "#e6f3ff"; // Light blue for selected cell
            }
          }
        }
        // When focus.type === "cell" or this cell has the cursor, no highlighting is applied (stays white)
      }
    }

    const { row, col } = cell;
    if (cellColors[row] === undefined) {
      cellColors[row] = [];
    }
    cellColors[row][col] = color;

    if (cellTextColors[row] === undefined) {
      cellTextColors[row] = [];
    }
    cellTextColors[row][col] = textColor;

    if (cellFontWeights[row] === undefined) {
      cellFontWeights[row] = [];
    }
    cellFontWeights[row][col] = fontWeight;
  });
  const getBorderStyle = (cell, isFocused) => {
    // Check if cell has a border property (CSS string or comma-separated sides)
    let hasBorderProperty = false;
    let borderPropertyStyle = '';

    if (cell.border && typeof cell.border === 'string') {
      hasBorderProperty = true;
      // Check if it's a CSS border string
      if (cell.border.includes('px') || cell.border.includes('solid') ||
          cell.border.includes('dashed') || cell.border.includes('dotted') ||
          cell.border.includes('#') || cell.border.includes('rgb') ||
          cell.border.includes('blue') || cell.border.includes('red') ||
          cell.border.includes('green') || cell.border.includes('black') ||
          cell.border.includes('gray') || cell.border.includes('grey')) {
        // Extract width and color for box-shadow
        const borderMatch = cell.border.match(/(\d+(?:\.\d+)?px)\s+\w+\s+(.+)/);
        if (borderMatch) {
          const [, width, color] = borderMatch;
          borderPropertyStyle = `box-shadow: inset 0 0 0 ${width} ${color}; `;
        } else {
          borderPropertyStyle = 'box-shadow: inset 0 0 0 2px #666; ';
        }
      } else {
        // Handle side specifications (e.g., "bottom", "top,left", "all")
        const sides = cell.border.split(',').map(s => s.trim().toLowerCase());
        const shadows = [];

        if (sides.includes('all')) {
          borderPropertyStyle = 'box-shadow: inset 0 0 0 2px #666; ';
        } else {
          // Create individual shadows for each side
          if (sides.includes('top')) {
            shadows.push('inset 0 2px 0 0 #666');
          }
          if (sides.includes('bottom')) {
            shadows.push('inset 0 -2px 0 0 #666');
          }
          if (sides.includes('left')) {
            shadows.push('inset 2px 0 0 0 #666');
          }
          if (sides.includes('right')) {
            shadows.push('inset -2px 0 0 0 #666');
          }

          if (shadows.length > 0) {
            borderPropertyStyle = `box-shadow: ${shadows.join(', ')}; `;
          }
        }
      }
    }

    // Generate CSS class for custom borders (legacy, not used with box-shadow)
    let borderClass = '';

    // Define default borders for different cell types
    let defaultBorders = {
      top: '1px solid #e0e0e0',    // Google Sheets light gray for all grid lines
      right: '1px solid #e0e0e0',
      bottom: '1px solid #e0e0e0',
      left: '1px solid #e0e0e0'
    };
    // Adjust defaults based on cell position and state
    if (cell.col === 1 && cell.row === 1) {
      defaultBorders.right = '1px solid #e0e0e0';  // Same color for all grid lines
      defaultBorders.bottom = cell.underline ? '2px solid #333' : '1px solid #e0e0e0';
    } else if (cell.col === 1) {
      defaultBorders.right = '1px solid #e0e0e0';
      defaultBorders.bottom = cell.underline ? '2px solid #333' : '1px solid #e0e0e0';
    } else if (cell.row === 1) {
      defaultBorders.bottom = cell.underline ? '2px solid #333' : '1px solid #e0e0e0';
    } else {
      defaultBorders.bottom = cell.underline ? '2px solid #333' : '1px solid #e0e0e0';
    }
    let styleStr = '';
    // Always apply default borders for the grid
    styleStr += `border-top: ${defaultBorders.top}; `;
    styleStr += `border-right: ${defaultBorders.right}; `;
    styleStr += `border-bottom: ${defaultBorders.bottom}; `;
    styleStr += `border-left: ${defaultBorders.left}; `;

    // Apply box-shadow for border property or focus
    if (isFocused) {
      // Focus takes precedence with !important
      styleStr += 'box-shadow: inset 0 0 0 2px #1a73e8 !important; z-index: 10; ';
    } else if (hasBorderProperty) {
      // Apply border property when not focused
      styleStr += borderPropertyStyle;
    }

    // Add text alignment and font weight
    if (cell.col === 1 || cell.row === 1) {
      styleStr += 'text-align: center; ';
    } else {
      styleStr += `font-weight: ${cell.fontWeight || "normal"}; text-align: ${cell.align || "right"}; `;
    }
    return { styleStr, borderClass };
  };

  const coloredCells = cells.map(cell => {
    const isFocused = selection.anchor > cell.from && selection.anchor < cell.to;
    const { styleStr, borderClass } = getBorderStyle(cell, isFocused);
    // Use the color from cellColors which includes our focus highlighting
    const focusColor = cellColors[cell.row] && cellColors[cell.row][cell.col];
    const focusTextColor = cellTextColors[cell.row] && cellTextColors[cell.row][cell.col];
    const focusFontWeight = cellFontWeights[cell.row] && cellFontWeights[cell.row][cell.col];
    return {
      ...cell,
      readonly: cell.readonly,
      border: styleStr,
      borderClass: borderClass,
      color: focusColor || ((cell.col === 1 || cell.row === 1) && "#f8f8f8") || "#fff",
      textColor: focusTextColor,
      fontWeight: focusFontWeight
    };
  });
  return applyDecoration({doc, cells: coloredCells});
}

const isTableCellOrHeader = node =>
      node.type.name === "table_cell" ||
      node.type.name === "table_header";

// const isTableCell = node =>
//       node.type.name === "table_cell";

const getCells = (cellExprs, state) => {
  const { doc } = state;
  const cells = [];
  let row = 0, col = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === "table_row") {
      row++;
      col = 0;
    }
    if (isTableCellOrHeader(node)) {
      col++;
      const name = node.attrs.name;
      const text = cellExprs && name && cellExprs.cells[name]?.text || node.textContent;
      const val = cellExprs && name && cellExprs.cells[name]?.val;
      const formula = cellExprs && name && cellExprs.cells[name]?.formula;
      const type = cellExprs && name && cellExprs.cells[name]?.type || 'text';
      cells.push({
        row,
        col,
        name,
        text,
        val,
        formula,
        type,
        from: pos,
        to: pos + node.nodeSize,
        align: node.attrs.align || node.attrs.justify,
        background: node.attrs.background,
        'background-color': node.attrs['background-color'] || node.attrs.backgroundColor,
        backgroundColor: node.attrs.backgroundColor || node.attrs['background-color'], // Store in both formats for compatibility
        'font-weight': node.attrs['font-weight'] || node.attrs.fontWeight,
        fontWeight: node.attrs.fontWeight || node.attrs['font-weight'], // Store in both formats for compatibility
        format: node.attrs.format,
        numberFormat: node.attrs.numberFormat,
        assess: node.attrs.assess,
        underline: node.attrs.underline,
        border: node.attrs.border,
        protected: node.attrs.protected,
      });
    }
  });
  return cells;
};

// const debouncedStateUpdate = debounce(({ state, editorState }) => {
//   state.apply({
//     type: "update",
//     args: {editorState},
//   });
// }, 1000);

const schema = new Schema({
  nodes: baseSchema.spec.nodes.append(
    tableNodes({
      tableGroup: 'block',
      cellContent: 'paragraph',
      cellAttributes: {
        name: {
          default: null,
          getFromDOM(dom) {
            return dom.dataset.name || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs.dataset = `data-name: ${value};`;
            }
          },
        },
        format: {
          default: null,
          getFromDOM(dom) {
            return dom.dataset.format || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs.dataset = `data-format: ${value};`;
            }
          },
        },
        assess: {
          default: null,
          getFromDOM(dom) {
            return JSON.parse(dom.dataset.format) || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs.dataset = `data-format: ${JSON.stringify(value)};`;
            }
          },
        },
        align: {
          default: null,
          getFromDOM(dom) {
            return dom.style.textAlign || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `text-align: ${value};`;
          },
        },
        justify: {
          default: null,
          getFromDOM(dom) {
            return dom.style.textAlign || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `text-align: ${value};`;
          },
        },
        readonly: {
          default: null,
          getFromDOM(dom) {
            return dom.dataset.readonly || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs['data-readonly'] = value;
              // Add a CSS class to visually indicate read-only status
              attrs.class = (attrs.class || '') + ' readonly-cell';
            }
          },
        },
        background: {
          default: null,
          getFromDOM(dom) {
            return dom.style.backgroundColor || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `background-color: ${value};`;
          },
        },
        'background-color': {
          default: null,
          getFromDOM(dom) {
            return dom.style.backgroundColor || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `background-color: ${value};`;
          },
        },
        // Backward compatibility: support camelCase
        backgroundColor: {
          default: null,
          getFromDOM(dom) {
            return dom.style.backgroundColor || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `background-color: ${value};`;
          },
        },
        'font-weight': {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontWeight || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-weight: ${value};`;
          },
        },
        // Backward compatibility: support camelCase
        fontWeight: {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontWeight || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-weight: ${value};`;
          },
        },
        'font-size': {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontSize || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-size: ${value};`;
          },
        },
        fontSize: {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontSize || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-size: ${value};`;
          },
        },
        'font-family': {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontFamily || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-family: ${value};`;
          },
        },
        fontFamily: {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontFamily || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-family: ${value};`;
          },
        },
        'font-style': {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontStyle || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-style: ${value};`;
          },
        },
        fontStyle: {
          default: null,
          getFromDOM(dom) {
            return dom.style.fontStyle || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `font-style: ${value};`;
          },
        },
        color: {
          default: null,
          getFromDOM(dom) {
            return dom.style.color || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `color: ${value};`;
          },
        },
        'text-decoration': {
          default: null,
          getFromDOM(dom) {
            return dom.style.textDecoration || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `text-decoration: ${value};`;
          },
        },
        textDecoration: {
          default: null,
          getFromDOM(dom) {
            return dom.style.textDecoration || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `text-decoration: ${value};`;
          },
        },
        'vertical-align': {
          default: null,
          getFromDOM(dom) {
            return dom.style.verticalAlign || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `vertical-align: ${value};`;
          },
        },
        verticalAlign: {
          default: null,
          getFromDOM(dom) {
            return dom.style.verticalAlign || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `vertical-align: ${value};`;
          },
        },
        height: {
          default: null,
          getFromDOM(dom) {
            return dom.style.height || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              // Use 'auto' for height to allow content to determine height
              // or use the specified value if provided
              const heightValue = value === 'auto' ? 'auto' : value;
              attrs.style = (attrs.style || '') + `height: ${heightValue}; min-height: 24px;`;
            } else {
              // Default behavior - let content determine height with minimum
              attrs.style = (attrs.style || '') + `height: auto; min-height: 24px;`;
            }
          },
        },
        underline: {
          default: null,
          getFromDOM(dom) {
            return dom.style.borderBottom || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `border-bottom: 1px solid black;`;
          },
        },
        border: {
          default: null,
          getFromDOM(dom) {
            return dom.dataset.border || null;
          },
          setDOMAttr(value, attrs) {
            if (value && typeof value === 'string') {
              // Just store the border value as data attribute
              // The actual rendering is handled in getBorderStyle
              attrs['data-border'] = value;
            }
          },
        },
        protected: {
          default: false,
          getFromDOM(dom) {
            return dom.dataset.protected === 'true';
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs['data-protected'] = 'true';
              // Add a CSS class to visually indicate protected status and hide cursor
              attrs.class = (attrs.class || '') + ' protected-cell';
              attrs.style = (attrs.style || '') + 'caret-color: transparent;';
            }
          },
        },
      },
    }),
  ),
  marks: baseSchema.spec.marks,
});

const findTable = $pos => {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "table") {
      return { pos: $pos.before(depth), node };
    }
  }
  return null;
}

const getTablePosition = state => {
  const { $from } = state.selection;
  const table = findTable($from);
  return table ? table.pos : null;
}

const letters = "_ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const getCellRowColFromName = name => {
  const colName = name.slice(0, 1);
  const rowName = name.slice(1);
  const col = letters.indexOf(colName);
  const row = +rowName;
  return {row, col};
};

const getCellNodeByName = ({ state, name }) => {
  const tablePos = getTablePosition(state);
  const tableNode = state.doc.nodeAt(tablePos);
  const tableMap = TableMap.get(tableNode);
  const { row, col } = getCellRowColFromName(name);
  const cellIndex = row * tableMap.width + col;
  const cellPos = tableMap.map[cellIndex] + tablePos + 1;
  const cellNode = state.doc.nodeAt(cellPos);
  return {node: cellNode, pos: cellPos};
}

const getAdjacentCellNodeByName = ({ state, name }) => {
  const { row, col } = getCellRowColFromName(name);
  const adjRow = row === 0 && row + 1 || row;
  const adjCol = col === 0 && col + 1 || col;
  const adjName = `${letters[adjCol]}${adjRow}`;
  return getCellNodeByName({state, name: adjName});
}

// const getCellNodeByName = ({doc, name}) => {
//   let result;
//   doc.descendants((node, pos) => {
//     if (result !== undefined) {
//       return false;
//     }
//     if (isTableCellOrHeader(node) && node.attrs.name === name) {
//       result = {node, pos};
//     }
//   });
//   result = result || {};
//   return result;
// };

const replaceCellContent = (editorView, name, newText, doMoveCursor = false) => {
  const { state, dispatch } = editorView;
  const { pos: cellPos, node: cellNode } = getCellNodeByName({state, name});
  if (!cellNode || !isTableCellOrHeader(cellNode)) {
    console.error("Invalid cell position or node type: " + JSON.stringify(cellNode, null, 2));
    return;
  }
  const contentStart = cellPos + 1;
  const contentEnd = cellPos + cellNode.nodeSize - 1;
  const paragraphNode = newText &&
        state.schema.node("paragraph", null, state.schema.text(newText)) ||
        state.schema.node("paragraph");
  const tr = state.tr;
  // Mark this as a system formatting update, not user input
  tr.setMeta("systemFormatting", true);
  tr.replaceWith(contentStart, contentEnd, paragraphNode);
  if (doMoveCursor) {
    let cursorPos = contentStart + 1;
    tr.setSelection(TextSelection.create(tr.doc, cursorPos + newText.length));
  }
  dispatch(tr);
}

const evalCell = ({ env, name }) => {
  const cell = env.cells[name];
  const text = cell?.text || "";
  const format = cell?.format || "";
  let result = {
    formula: text,
    val: text,
    format: format,
    type: 'text', // Default type is text
  };

  // Check for undefined function references and cycles before evaluation for formulas
  if (text && text.length > 0 && text.indexOf("=") === 0) {
    // Check for undefined name references (functions or variables)
    const supportedFunctions = evalRules.types.fn;
    const namePattern = /([A-Za-z][A-Za-z0-9_]*)/g;
    const cellNamePattern = /^[A-Za-z]+[0-9]+$/; // Pattern for valid cell names like A1, B2, AA10
    let match;
    const undefinedNames = [];
    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      const nameLower = name.toLowerCase();
      // Skip if it's a valid cell reference (letters followed by numbers)
      if (cellNamePattern.test(name)) {
        continue;
      }
      // Skip if it's a supported function
      if (supportedFunctions.includes(nameLower)) {
        continue;
      }
      // It's an undefined name
      undefinedNames.push(name);
    }
    if (undefinedNames.length > 0) {
      const uniqueNames = [...new Set(undefinedNames)]; // Remove duplicates
      return {
        formula: text,
        val: "#NAME!",
        format: format,
        type: 'error',
        error: `Undefined name${uniqueNames.length > 1 ? 's' : ''}: ${uniqueNames.join(', ')}`
      };
    }

    const cycleCheck = detectCycles({ env, startCell: name });
    if (cycleCheck.hasCycle) {
      return {
        formula: text,
        val: "#CYCLE!",
        format: format,
        type: 'error',
        error: `Circular dependency: ${cycleCheck.cyclePath?.join(' → ')}`
      };
    }
  }

  // Apply normalization for non-formula input
  if (text && !text.startsWith('=')) {
    // Try to normalize as date first
    const normalizedDate = normalizeDateInput(text);
    if (normalizedDate) {
      // Store as string but mark type as date
      result.val = String(normalizedDate);
      result.type = 'date';
    } else {
      // Try to normalize as number
      const normalizedNumber = normalizeNumberInput(text);
      if (normalizedNumber !== null) {
        // Store as string but mark type as number
        result.val = String(normalizedNumber);
        result.type = 'number';
      }
    }
  }
  try {
    // Only process formulas through TransLaTeX
    if (text && text.length > 0 && text.indexOf("=") === 0) {
      const options = {
        // allowThousandsSeparator: true,
        keepTextWhitespace: true,
        env: env.cells,
        ...evalRules,
      };
      const processedText = toUpperCase(text);
      const translate = TransLaTeX.buildTranslator(options, spreadsheetExpanders);
      translate(processedText, (err, val) => {
        if (err && err.length) {
          console.error(err);
        }
        // Store val as string but set appropriate type
        // Helper to check if a value is truly numeric
        const isNumericValue = (v) => {
          if (typeof v === 'number') return true;
          if (typeof v === 'string') {
            const trimmed = v.trim();
            if (trimmed === '') return false;
            // Use Number() for the conversion which handles the full string
            const num = Number(trimmed);
            // Check if it's a valid number and the conversion consumed the whole string
            return !isNaN(num) && isFinite(num);
          }
          return false;
        };

        // Check if it's a date format first
        if (isDateFormat(format) && isNumericValue(val)) {
          // Keep as string but mark as date type
          result = {
            ...result,
            val: String(val),
            type: 'date', // Formula result is a date
          };
        }
        // Check if it's a number
        else if (isNumericValue(val)) {
          // Convert to string for storage but mark as number type
          result = {
            ...result,
            val: String(val),
            type: 'number', // Formula result is a number
          };
        }
        // Otherwise it's text
        else {
          result = {
            ...result,
            val: String(val),
            type: 'text', // Formula result is text
          };
        }
      });
    }
  } catch (x) {
    console.log("parse error: " + x.stack);
  }
  return result;
}

const fixText = text => {
  // Convert to string if not already
  const str = typeof text === 'string' ? text : String(text || '');
  return str
    .replace(new RegExp("\\{\\{", "g"), "[[")
    .replace(new RegExp("\\}\\}", "g"), "]]");
};

const isDateFormat = (format) => {
  const dateFormatPatterns = [
    'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD',
    'MM-DD-YYYY', 'DD-MM-YYYY', 'M/D/YY', 'D/M/YY',
    'MMM DD, YYYY', 'DD MMM YYYY', 'date'
  ];
  return format && dateFormatPatterns.some(pattern =>
    format.toLowerCase().includes(pattern.toLowerCase())
  );
};

const formatCellValue = ({ env, name }) => {
  console.log(
    "formatCellValue()",
    "name=" + name,
    "env=" + JSON.stringify(env),
  );
  const cell = env.cells[name] || {};
  const val = cell.val;
  const type = cell.type || 'text';
  const format = cell.format || "";
  let result = val;

  // Handle date serial numbers based on type and format
  const isDateFormatted = isDateFormat(format);
  // Convert string val to number if it's a date type
  if ((type === 'date' || isDateFormatted) && val) {
    const numVal = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(numVal)) {
      const excelEpoch = new Date(1904, 0, 1);
      const msPerDay = 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + (numVal - 1) * msPerDay);
    // Apply specific date format
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const yearShort = year.toString().slice(-2);
    if (format.includes('DD/MM/YYYY')) {
      result = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    } else if (format.includes('DD-MM-YYYY')) {
      result = `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`;
    } else if (format.includes('YYYY-MM-DD')) {
      result = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    } else if (format.includes('MM-DD-YYYY')) {
      result = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${year}`;
    } else if (format.includes('M/D/YY')) {
      result = `${month}/${day}/${yearShort}`;
    } else if (format.includes('D/M/YY')) {
      result = `${day}/${month}/${yearShort}`;
    } else if (format.includes('MMM DD, YYYY')) {
      result = `${monthNames[date.getMonth()]} ${day.toString().padStart(2, '0')}, ${year}`;
    } else if (format.includes('DD MMM YYYY')) {
      result = `${day.toString().padStart(2, '0')} ${monthNames[date.getMonth()]} ${year}`;
    } else {
      // Default to MM/DD/YYYY
      result = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
    }
    }
  }
  try {
    // Convert numbers to strings for TransLaTeX formatting
    if (typeof result === 'number' && format && !isDateFormatted) {
      result = result.toString();
    }
    // FIXME date formatting in translatex assumes input is a formatted string,
    // not a date serial number. For now, only process string values with format
    // rules (skip if we already formatted a date)
    if (format && result && typeof result === 'string' && result.length > 0 && !isDateFormatted) {
      const options = {
        allowInterval: true,
        keepTextWhitespace: true,
        RHS: false,
        env: {format},
        ...formatRules,
      };
      const processedVal = wrapPlainTextInLatex(result);
      const translate = TransLaTeX.buildTranslator(options, spreadsheetExpanders);
      translate(processedVal, (err, val) => {
        if (err && err.length) {
          console.error(err);
        }
        result = val;
      });
    }
  } catch (x) {
    console.log("parse error: " + x.stack);
  }
  return result;
}


const getSingleCellDependencies = ({ env, name }) => {
  const text = env.cells[name]?.text || "";
  let result = text;
  try {
    const options = {
      // allowThousandsSeparator: true,
      env: env.cells,
      ...cellNameRules,
    };
    if (text && text.length > 0 && text.indexOf("=") === 0) {
      // FIXME this condition is brittle.
      const translate = TransLaTeX.buildTranslator(options, spreadsheetExpanders);
      translate(text, (err, val) => {
        if (err && err.length) {
          console.error(err);
        }
        result = val.split(",").map(name => name.toUpperCase());
      });
    } else {
      result = [];
    }
  } catch (x) {
    console.log("parse error: " + x.stack);
  }
  return result;
};

// Cycle detection using DFS with three-color approach
interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[];
  dependencies: string[];
}

const detectCycles = ({ env, startCell }: { env: any; startCell: string }): CycleDetectionResult => {
  const GRAY = 1, BLACK = 2;
  const colors = new Map<string, number>();
  const dependencies = new Set<string>();
  let cyclePath: string[] = [];
  let hasCycle = false;

  const dfs = (cell: string, path: string[]): boolean => {
    if (colors.get(cell) === GRAY) {
      // Found a back edge - cycle detected
      const cycleStart = path.indexOf(cell);
      cyclePath = path.slice(cycleStart).concat([cell]);
      return true;
    }

    if (colors.get(cell) === BLACK) {
      // Already processed, no cycle in this path
      return false;
    }

    // Mark as currently being processed
    colors.set(cell, GRAY);
    // Get direct dependencies of this cell
    const cellDeps = getSingleCellDependencies({ env, name: cell });
    for (const dep of cellDeps) {
      dependencies.add(dep);
      if (dfs(dep, [...path, cell])) {
        return true; // Cycle found
      }
    }

    // Mark as completely processed
    colors.set(cell, BLACK);
    return false;
  };

  hasCycle = dfs(startCell, []);

  return {
    hasCycle,
    cyclePath: hasCycle ? cyclePath : undefined,
    dependencies: Array.from(dependencies)
  };
};

const getCellDependencies = ({ env, names }) => {
  // Get the cells that `names` depend on with cycle detection
  const allDeps = new Set<string>();
  for (const name of names) {
    const result = detectCycles({ env, startCell: name });
    if (result.hasCycle) {
      console.error(`Circular dependency detected in cell ${name}: ${result.cyclePath?.join(' → ')}`);
      // Continue processing other cells but don't add dependencies for cyclic cells
      continue;
    }
    result.dependencies.forEach(dep => allDeps.add(dep));
  }
  return Array.from(allDeps);
};

const makeTableHeadersReadOnlyPlugin = (formState) => new Plugin({
  view(editorView) {
    // Add a capture phase event listener to catch shift-clicks and cmd/ctrl-clicks on headers and cells
    const handleModifierClick = (event) => {
      // Check for shift-click (range selection) or cmd/ctrl-click (toggle selection)
      const isShiftClick = event.shiftKey;
      const isToggleClick = event.metaKey || event.ctrlKey; // metaKey for Mac, ctrlKey for Windows/Linux

      if (!isShiftClick && !isToggleClick) return;

      // Find if we clicked on a header or cell
      const target = event.target;
      let headerElement = target;

      // Walk up the DOM tree to find a table header or cell
      while (headerElement && headerElement !== editorView.dom) {
        if (headerElement.nodeName === 'TH' || headerElement.classList?.contains('ProseMirror-tableheader') ||
            headerElement.nodeName === 'TD' || headerElement.classList?.contains('ProseMirror-tablecell')) {
          // Get position in ProseMirror document
          const pos = editorView.posAtDOM(headerElement, 0);
          const $pos = editorView.state.doc.resolve(pos);

          // Find the header or cell node
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (node.type.name === "table_cell") {
              // Handle modifier-click on table cells
              const cellName = node.attrs.name;
              const currentFocus = formState.data.focus;

              if (isToggleClick) {
                // Cmd/Ctrl-click: Toggle selection of individual cells
                let selectedCells = [];

                if (currentFocus && currentFocus.type === "cell") {
                  if (currentFocus.cells && currentFocus.cells.length > 0) {
                    // Already have multiple cells selected
                    selectedCells = [...currentFocus.cells];
                  } else if (currentFocus.name) {
                    // Single cell selected - convert to array
                    selectedCells = currentFocus.name.split(',').map(c => c.trim());
                  }
                }

                // Toggle the clicked cell
                const cellIndex = selectedCells.indexOf(cellName);
                if (cellIndex > -1) {
                  // Remove cell if already selected
                  selectedCells.splice(cellIndex, 1);
                } else {
                  // Add cell if not selected
                  selectedCells.push(cellName);
                }

                if (selectedCells.length > 0) {
                  formState.apply({
                    type: "focus",
                    args: {
                      type: "cell",
                      name: selectedCells.join(','),
                      cells: selectedCells,
                      isRange: false,  // Not a contiguous range
                      isMultiple: true,  // Multiple individual selections
                    },
                  });
                } else {
                  // No cells selected - clear focus
                  formState.apply({
                    type: "focus",
                    args: null,
                  });
                }

                // Update decorations
                const tr = editorView.state.tr;
                tr.setMeta("focusChanged", true);
                editorView.dispatch(tr);

                event.preventDefault();
                event.stopPropagation();
                return;

              } else if (isShiftClick && currentFocus && currentFocus.type === "cell") {
                // Shift-click: Create range selection
                let startCell = null;

                if (currentFocus.isRange && currentFocus.cells && currentFocus.cells.length > 0) {
                  // Use the first cell of the range as the anchor
                  startCell = currentFocus.cells[0];
                } else if (currentFocus.name && !currentFocus.name.includes(',')) {
                  // Single cell selected
                  startCell = currentFocus.name;
                }

                if (startCell && startCell !== cellName) {
                  const rangeCells = getCellRange(startCell, cellName);

                  if (rangeCells.length > 0) {
                    formState.apply({
                      type: "focus",
                      args: {
                        type: "cell",
                        name: rangeCells.join(','),  // Send as comma-separated list
                        cells: rangeCells,  // Also include array for internal use
                        isRange: true,  // Flag to indicate this is a range
                      },
                    });

                    // Update decorations
                    const tr = editorView.state.tr;
                    tr.setMeta("focusChanged", true);
                    editorView.dispatch(tr);

                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                }
              }
              break;
            } else if (node.type.name === "table_header") {
              const name = node.attrs.name;
              const colPart = name?.match(/^([_A-Z]+)/)?.[1];
              const rowPart = name?.match(/(\d+)$/)?.[1];

              if (colPart && colPart !== "_" && rowPart === "0") {
                // Column header click
                const currentFocus = formState.data.focus;

                if (isToggleClick) {
                  // Cmd/Ctrl-click: Toggle column selection
                  let selectedColumns = [];

                  if (currentFocus && currentFocus.type === "column") {
                    if (currentFocus.columns && currentFocus.columns.length > 0) {
                      selectedColumns = [...currentFocus.columns];
                    } else if (currentFocus.name) {
                      selectedColumns = [currentFocus.name];
                    }
                  }

                  // Toggle the clicked column
                  const colIndex = selectedColumns.indexOf(colPart);
                  if (colIndex > -1) {
                    selectedColumns.splice(colIndex, 1);
                  } else {
                    selectedColumns.push(colPart);
                  }

                  if (selectedColumns.length > 0) {
                    formState.apply({
                      type: "focus",
                      args: {
                        type: "column",
                        name: selectedColumns[0], // First column as anchor
                        columns: selectedColumns,
                        isMultiple: true,
                      },
                    });
                  } else {
                    formState.apply({
                      type: "focus",
                      args: null,
                    });
                  }

                  // Update decorations
                  const tr = editorView.state.tr;
                  tr.setMeta("focusChanged", true);
                  tr.setMeta("headerClick", true);
                  editorView.dispatch(tr);

                  event.preventDefault();
                  event.stopPropagation();
                  return;

                } else if (isShiftClick && currentFocus && currentFocus.type === "column" && currentFocus.name) {
                  // Shift-click: Create range from anchor column to clicked column
                  const rangeColumns = getColumnRange(currentFocus.name, colPart);

                  formState.apply({
                    type: "focus",
                    args: {
                      type: "column",
                      name: currentFocus.name, // Keep original anchor
                      columns: rangeColumns,
                    },
                  });

                  // Update decorations
                  const tr = editorView.state.tr;
                  tr.setMeta("focusChanged", true);
                  tr.setMeta("headerClick", true);
                  editorView.dispatch(tr);

                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
              } else if (colPart === "_" && rowPart && rowPart !== "0") {
                // Row header click
                const currentFocus = formState.data.focus;

                if (isToggleClick) {
                  // Cmd/Ctrl-click: Toggle row selection
                  let selectedRows = [];

                  if (currentFocus && currentFocus.type === "row") {
                    if (currentFocus.rows && currentFocus.rows.length > 0) {
                      selectedRows = [...currentFocus.rows];
                    } else if (currentFocus.name) {
                      selectedRows = [currentFocus.name];
                    }
                  }

                  // Toggle the clicked row
                  const rowIndex = selectedRows.indexOf(rowPart);
                  if (rowIndex > -1) {
                    selectedRows.splice(rowIndex, 1);
                  } else {
                    selectedRows.push(rowPart);
                  }

                  if (selectedRows.length > 0) {
                    formState.apply({
                      type: "focus",
                      args: {
                        type: "row",
                        name: selectedRows[0], // First row as anchor
                        rows: selectedRows,
                        isMultiple: true,
                      },
                    });
                  } else {
                    formState.apply({
                      type: "focus",
                      args: null,
                    });
                  }

                  // Update decorations
                  const tr = editorView.state.tr;
                  tr.setMeta("focusChanged", true);
                  tr.setMeta("headerClick", true);
                  editorView.dispatch(tr);

                  event.preventDefault();
                  event.stopPropagation();
                  return;
                } else if (isShiftClick && currentFocus && currentFocus.type === "row" && currentFocus.name) {
                  // Shift-click: Create range selection
                  const rangeRows = getRowRange(currentFocus.name, rowPart);

                  formState.apply({
                    type: "focus",
                    args: {
                      type: "row",
                      name: currentFocus.name, // Keep original anchor
                      rows: rangeRows,
                    },
                  });

                  // Update decorations
                  const tr = editorView.state.tr;
                  tr.setMeta("focusChanged", true);
                  tr.setMeta("headerClick", true);
                  editorView.dispatch(tr);

                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
              }
              break;
            }
          }
          break;
        }
        headerElement = headerElement.parentElement;
      }
    };

    // Add listener in capture phase to intercept before ProseMirror
    editorView.dom.addEventListener('mousedown', handleModifierClick, true);

    return {
      destroy() {
        editorView.dom.removeEventListener('mousedown', handleModifierClick, true);
      }
    };
  },
  props: {
    handleClickOn(view, _pos, node, _nodePos, event, _direct) {
      const { state, dispatch } = view;

      // Check if the clicked node is a `table_header`
      if (node.type.name === "table_header") {
        // If shift is held, let the capture phase handler deal with it
        if (event && event.shiftKey) {
          return false; // Let other handlers process this
        }
        // Create a selection for the adjacent cell instead
        const name = node.attrs.name || "_0";

        // Dispatch focus action for header click
        if (name) {
          // Parse the cell name to determine column and row
          const colPart = name.match(/^([_A-Z]+)/)?.[1];
          const rowPart = name.match(/(\d+)$/)?.[1];

          if (colPart === "_" && rowPart === "0") {
            // Top-left corner header (_0)
            formState.apply({
              type: "focus",
              args: {
                type: "sheet",
              },
            });
            // Force re-render to update decorations with new focus
            const updateTr = state.tr;
            updateTr.setMeta("focusChanged", true);
            updateTr.setMeta("headerClick", true);
            dispatch(updateTr);
          } else if (colPart && colPart !== "_" && rowPart === "0") {
            // Column header (e.g., A0, B0, C0)
            // Single column selection (replace existing)
            formState.apply({
              type: "focus",
              args: {
                type: "column",
                name: colPart,
                columns: [colPart], // Also store as array for consistency
              },
            });
            // Force re-render to update decorations with new focus
            const updateTr = state.tr;
            updateTr.setMeta("focusChanged", true);
            updateTr.setMeta("headerClick", true);
            dispatch(updateTr);
          } else if (colPart === "_" && rowPart && rowPart !== "0") {
            // Row header (e.g., _1, _2, _3)
            formState.apply({
              type: "focus",
              args: {
                type: "row",
                name: rowPart,
                rows: [rowPart], // Store as array for consistency
              },
            });
            // Force re-render to update decorations with new focus
            const updateTr = state.tr;
            updateTr.setMeta("focusChanged", true);
            updateTr.setMeta("headerClick", true);
            dispatch(updateTr);
          }
        }

        const { pos: adjPos, node: adjNode } = getAdjacentCellNodeByName({state, name});
        if (adjPos && adjNode) {
          const cursorPos = adjPos + 2;
          const newText = adjNode.textContent;
          const selection = TextSelection.create(state.tr.doc, cursorPos + newText.length);

          // Dispatch the transaction with a meta flag indicating this is a synthetic focus
          const tr = state.tr.setSelection(selection);
          tr.setMeta("syntheticFocus", true);
          dispatch(tr);
        }
        return true; // Prevent further handling
      }

      return false; // Allow other events to be handled normally
    },

    handleDOMEvents: {
      mousedown(view, event) {
        // This handler is now redundant since we use capture phase listener
        // But keeping it for backward compatibility with non-shift clicks
        if (!event.shiftKey) return false;

        // Get the position in the document from the mouse event
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!pos) {
          return false;
        }

        // Get the node at this position
        const $pos = view.state.doc.resolve(pos.pos);
        let headerNode = null;
        let headerName = null;

        // Find the table header node
        for (let depth = $pos.depth; depth > 0; depth--) {
          const node = $pos.node(depth);
          if (node.type.name === "table_header") {
            headerNode = node;
            headerName = node.attrs.name;
            break;
          }
        }

        if (headerNode && headerName) {
          const { state, dispatch } = view;
          const name = headerName;

          // Parse the cell name to determine column and row
          const colPart = name.match(/^([_A-Z]+)/)?.[1];
          const rowPart = name.match(/(\d+)$/)?.[1];

          if (colPart && colPart !== "_" && rowPart === "0") {
            // Column header (e.g., A0, B0, C0)
            const currentFocus = formState.data.focus;

            // Check if shift key is held for discontiguous selection
            if (event.shiftKey && currentFocus && currentFocus.type === "column") {
              // Add to existing column selection
              const selectedColumns = currentFocus?.columns || (currentFocus?.name ? [currentFocus?.name] : []);
              const newColumns = selectedColumns.includes(colPart)
                ? selectedColumns.filter(col => col !== colPart) // Toggle off if already selected
                : [...selectedColumns, colPart]; // Add to selection

              formState.apply({
                type: "focus",
                args: {
                  type: "column",
                  columns: newColumns,
                },
              });

              // Force re-render to update decorations with new focus
              const updateTr = state.tr;
              updateTr.setMeta("focusChanged", true);
              updateTr.setMeta("headerClick", true);
              dispatch(updateTr);
              event.preventDefault();
              return true; // Prevent default handleClickOn from running
            }
          }
        }
        return false; // Let normal processing continue
      },
      beforeinput(view, event) {
        if (isInsideTableHeader(view.state)) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      keydown(view, event) {
        const { state, dispatch } = view;

        // Check if we're in a header cell already
        if (isInsideTableHeader(state)) {
          event.preventDefault();

          // If it's tab, use our reliable tab handler
          if (event.key === 'Tab') {
            const dir = event.shiftKey ? -1 : 1;
            skipHeadersGoToNextCell(dir)(state, dispatch);
            return true;
          }

          // For all other cases, try to move to B2 (first data cell)
          const { pos } = getCellNodeByName({state, name: "B2"});
          if (pos) {
            const tr = state.tr;
            const resolvedPos = state.doc.resolve(pos);
            // Mark this as our redirected transaction to prevent recursion
            tr.setMeta("_headerRedirect", true);
            tr.setSelection(new TextSelection(resolvedPos));
            dispatch(tr);
          }

          return true; // Prevent default handling
        }

        // For all navigation keys, check if they would move into a header
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          // Get current position
          const $pos = state.selection.$anchor;
          const table = findTable($pos);

          if (table) {
            const tableNode = state.doc.nodeAt(table.pos);
            const tableMap = TableMap.get(tableNode);
            const width = tableMap.width;

            // Get current cell position
            const cellPos = $pos.pos - table.pos - 1;
            let currentMapIndex = -1;
            for (let i = 0; i < tableMap.map.length; i++) {
              if (tableMap.map[i] <= cellPos && (i === tableMap.map.length - 1 || tableMap.map[i + 1] > cellPos)) {
                currentMapIndex = i;
                break;
              }
            }

            if (currentMapIndex !== -1) {
              const row = Math.floor(currentMapIndex / width);
              const col = currentMapIndex % width;
              const height = tableMap.height;

              // Check if the move would end up in a header
              if ((event.key === 'ArrowUp' && row === 1) ||
                  (event.key === 'ArrowLeft' && col === 1)) {
                event.preventDefault();
                return true; // Block the navigation
              }

              // Block navigation at edges to prevent wrapping to headers
              if ((event.key === 'ArrowRight' && col === width - 1) ||
                  (event.key === 'ArrowDown' && row === height - 1)) {
                event.preventDefault();
                return true; // Block navigation at the edge
              }
            }
          }
        }

        return false;
      },
      copy(_view, _event) {
        // Still allow copying from headers
        return false;
      },
      paste(view, event) {
        if (isInsideTableHeader(view.state)) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      cut(view, event) {
        if (isInsideTableHeader(view.state)) {
          event.preventDefault();
          return true;
        }
        return false;
      }
    }
  },

  filterTransaction(tr, state) {
    // Skip our own redirected transactions - add a meta flag to prevent recursion
    if (tr.getMeta("_headerRedirect")) {
      return true;
    }

    // Check if this transaction would modify content inside a table header
    if (tr.steps.length > 0 && isInsideTableHeader(state)) {
      // Block content modification transactions, but allow selection changes
      const isSelectionOnly = tr.steps.every(step => step.toJSON().stepType === "setSelection");
      return isSelectionOnly;
    }

    // For selection-only transactions, check if they would land in a header
    // WITHOUT applying the transaction (which would cause recursion)
    if (tr.selectionSet) {
      // Check if this would land in a header by examining the position directly
      const $pos = tr.selection.$anchor;
      if ($pos) {
        for (let depth = $pos.depth; depth > 0; depth--) {
          const node = $pos.node(depth);
          if (node && node.type.name === "table_header") {
            return false; // Cancel the transaction
          }
        }

        // Also check if this is an attempt to wrap around the table
        // by preventing selection of cell at position 0,0
        if ($pos.pos === 1) {
          return false; // Cancel any transaction that tries to select the first position
        }
      }
    }

    return true;
  }
});

// Helper function to check if current selection is inside a table header
function isInsideTableHeader(state) {
  const { selection } = state;
  return isPosInHeader(state, selection.$anchor.pos);
}

// Helper function to check if current selection is inside a protected cell
function isInsideProtectedCell(state) {
  const { selection } = state;
  const $pos = state.doc.resolve(selection.$anchor.pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "table_cell" && node.attrs.protected === true) {
      return true;
    }
  }
  return false;
}

const makeProtectedCellsPlugin = (tooltipHandler) => new Plugin({
  props: {
    handleDOMEvents: {
      beforeinput(view, event) {
        if (isInsideProtectedCell(view.state)) {
          event.preventDefault();
          tooltipHandler?.showTooltip(event);
          return true;
        }
        return false;
      },
      input(view, event) {
        if (isInsideProtectedCell(view.state)) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      keypress(view, event) {
        if (isInsideProtectedCell(view.state)) {
          event.preventDefault();
          tooltipHandler?.showTooltip(event);
          return true;
        }
        return false;
      },
      keydown(view, event) {
        if (isInsideProtectedCell(view.state)) {
          // Allow navigation keys but block content modification
          const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape', 'Home', 'End', 'PageUp', 'PageDown'];
          const isNavigationKey = allowedKeys.includes(event.key);
          const isModifierKey = event.metaKey || event.ctrlKey || event.altKey;
          // Allow navigation keys and modifier combinations (like Ctrl+C)
          if (!isNavigationKey && !isModifierKey) {
            event.preventDefault();
            tooltipHandler?.showTooltip(event);
            return true;
          }
          // Allow specific modifier combinations for copy operations
          if (isModifierKey && ['c', 'C', 'v', 'V', 'x', 'X', 'a', 'A', 'z', 'Z', 'y', 'Y'].includes(event.key)) {
            // Allow copy (Ctrl+C), but prevent paste (Ctrl+V), cut (Ctrl+X), and undo/redo
            if (['v', 'V', 'x', 'X', 'z', 'Z', 'y', 'Y'].includes(event.key)) {
              event.preventDefault();
              tooltipHandler?.showTooltip(event);
              return true;
            }
          }
        }
        return false;
      },
      paste(view, event) {
        if (isInsideProtectedCell(view.state)) {
          event.preventDefault();
          tooltipHandler?.showTooltip(event);
          return true;
        }
        return false;
      },
      cut(view, event) {
        if (isInsideProtectedCell(view.state)) {
          event.preventDefault();
          tooltipHandler?.showTooltip(event);
          return true;
        }
        return false;
      },
      drop(view, event) {
        if (isInsideProtectedCell(view.state)) {
          event.preventDefault();
          tooltipHandler?.showTooltip(event);
          return true;
        }
        return false;
      }
    }
  },

  filterTransaction(tr, state) {
    // Allow system formatting updates for protected cells
    if (tr.getMeta("systemFormatting")) {
      return true;
    }
    // Check if this transaction would modify content inside a protected cell
    if (tr.steps.length > 0) {
      // Check if any step would affect a protected cell
      for (let step of tr.steps) {
        const stepJSON = step.toJSON();
        // Block any content modification steps when in a protected cell
        if (stepJSON.stepType !== "setSelection" && isInsideProtectedCell(state)) {
          return false;
        }
        // Also check if the step would modify a protected cell position
        if (stepJSON.stepType === "replace" && stepJSON.from !== undefined) {
          const $pos = state.doc.resolve(stepJSON.from);
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (node.type.name === "table_cell" && node.attrs.protected === true) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }
});


const getResponses = cells => (
  Object.keys(cells).reduce(
    (acc, name) => {
      const {text, val, formula, assess} = cells[name];
      return assess && {
        ...acc,
        [name]: {text, val, formula},
      } || acc
    }, {}
  )
);

const getChangedCells = (cells, changedNames) => (
  changedNames.reduce((acc, name) => {
    const cell = cells[name];
    if (!cell) return acc;
    const { text } = cell;
    const formattedValue = formatCellValue({ env: { cells }, name });
    console.log(
      "formattedValue=" + formattedValue,
    );
    return {
      ...acc,
      [name]: { text, formattedValue },
    };
  }, {})
);

const buildCellPlugin = formState => {
  let initialUpdateSent = false;
  const self = new Plugin({
    view(editorView) {
      editorView = editorView;
      return {
        update(view) {
          const { state, dispatch } = view;
          const pluginState = self.getState(state);
          if (pluginState.dirtyCells.length > 0) {
            const tr = state.tr;
            tr.setMeta("updated", true);
            dispatch(tr);
          } else if (!initialUpdateSent) {
            // Send initial update after dirty cells are processed
            initialUpdateSent = true;
            const cells = pluginState.cells || {};
            const allCellNames = Object.keys(cells);
            if (allCellNames.length > 0) {
              formState.apply({
                type: "update",
                args: {
                  cells: getChangedCells(cells, allCellNames),
                },
              });
            }
          }
          const cells = {...pluginState.cells};
          const { columns, cells: interactionCells, rows } = formState.data.interaction;
          // First merge cell attributes from formState
          if (interactionCells) {
            Object.keys(cells).forEach(cellName => {
              const interactionCell = interactionCells[cellName];
              const format = interactionCell?.attrs?.format;
              if (format) {
                cells[cellName] = {
                  ...cells[cellName],
                  format: format,
                };
              }
            });
          }
          // Then merge column attributes into cells
          Object.keys(cells).forEach(cellName => {
            const colName = cellName.slice(0, 1); // Extract column letter (A, B, C, etc.)
            const rowNum = parseInt(cellName.slice(1));

            // Skip header row (row 1) when applying column attributes
            if (rowNum <= 1) {
              return;
            }

            const columnAttrs = columns && columns[colName];
            if (columnAttrs) {
              // Merge any column attributes that aren't already set on the cell
              Object.keys(columnAttrs).forEach(attr => {
                if (columnAttrs[attr] !== undefined && !cells[cellName]?.[attr]) {
                  cells[cellName] = {
                    ...cells[cellName],
                    [attr]: columnAttrs[attr],
                  };
                }
              });
            }
          });
          // Then merge row attributes into cells
          Object.keys(cells).forEach(cellName => {
            const rowNum = parseInt(cellName.slice(1));

            // Skip invalid row numbers
            if (!rowNum || rowNum <= 0) {
              return;
            }

            const rowAttrs = rows && rows[rowNum];
            if (rowAttrs) {
              // Merge any row attributes that aren't already set on the cell
              Object.keys(rowAttrs).forEach(attr => {
                if (rowAttrs[attr] !== undefined && !cells[cellName]?.[attr]) {
                  cells[cellName] = {
                    ...cells[cellName],
                    [attr]: rowAttrs[attr],
                  };
                }
              });
            }
          });
          pluginState.dirtyCells.forEach(name => {
            cells[name] = {
              ...cells[name],
              ...evalCell({ env: {cells}, name }),
            };
            const formattedVal = fixText(formatCellValue({env: {cells}, name}));
            const { node } = getCellNodeByName({state: view.state, name});
            if (name !== pluginState.focusedCell && formattedVal !== node.textContent) {
              replaceCellContent(view, name, formattedVal);
            }
          });
          if (pluginState.focusedCell) {
            const name = pluginState.focusedCell;
            const text = fixText(pluginState.cells[name]?.text || "");
            const { node } = getCellNodeByName({state: view.state, name});
            if (node.type.name === "table_cell" && text !== node.textContent) {
              replaceCellContent(view, name, text, true);
            }
          }
        }
      };
    },
    state: {
      init(config, state) {
        config = config;
        const cellExprs = self.getState(state);
        const cells = getCells(cellExprs, state).reduce((cells, cell) => (
          cell.row > 1 && cell.col > 1 && {
            ...cells,
            [cell.name]: {
              ...cell,
              deps: [],
            }
          } || cells
        ), {});
        const dirtyCells = getCells(cellExprs, state).reduce((dirtyCells, cell) => (
          cell.row > 1 && cell.col > 1 && cell.text &&
            [...dirtyCells, cell.name] ||
            dirtyCells
        ), []);
        const cellsWithDeps = getCells(cellExprs, state).reduce((cells, cell) => {
          if (cell.row > 1 && cell.col > 1)  {
            const deps = getCellDependencies({env: {cells}, names: [cell.name]});
            const cellName = cell.name;
            return deps.reduce((cells, name) => {
              // Add current cell as dependency of independent cells.
              const { formula, val } = evalCell({env: {cells}, name});
              const cell = cells[name];
              return cell && {
                ...cells,
                [name]: {
                  ...cell,
                  formula,
                  val,
                  deps: [
                    ...cell?.deps,
                    cellName,
                  ],
                  format: cell.format,
                },
              } || cells;
            }, cells);
          } else {
            return cells;
          }
        }, cells);
        const allCells = dirtyCells.reduce((cells, name) => {
          // Add current cell as dependency of independent cells.
          const cell = cells[name];
          return cell && {
            ...cells,
            [name]: {
              ...cell,
              ...evalCell({env: {cells}, name}),
              deps: [
                ...cell?.deps,
              ],
            },
          } || cells;
        }, cellsWithDeps);
        const value = {
          lastFocusedCell: null,
          blurredCell: null,
          focusedCell: null,
          lastHeaderClick: 0,
          dirtyCells,
          cells: allCells,
        };
        const validation = formState.data?.validation || null;
        const decorations = applyModelRules(cellExprs, state, value, validation, formState);
        return {
          ...value,
          decorations,
        }
      },
      apply(tr, value, oldState, state) {
        oldState = oldState;
        if (tr.getMeta("updated")) {
          value = {
            ...value,
            focusedCell: null,
            dirtyCells: [],
          };
        }
        // Track header clicks
        if (tr.getMeta("headerClick")) {
          value = {
            ...value,
            lastHeaderClick: Date.now(),
          };
        }
        // Force recalculation of decorations when focus changes
        if (tr.getMeta("focusChanged") || tr.getMeta("focusCleared") || tr.getMeta("headerClick")) {
          const cellExprs = self.getState(state);
          const { validation } = formState.data;
          const decorations = applyModelRules(cellExprs, state, value, validation, formState);
          return {
            ...value,
            decorations,
          };
        }
        const { selection } = state;
        const $anchor = selection.$anchor;
        const node = $anchor.node(-1);
        const name = node.attrs?.name;
        const lastFocusedCell = value.lastFocusedCell;
        if (lastFocusedCell !== name) {
          // We just left a cell, so compute its value, add to its dependencies
          // dependents list (`deps`), and recompute the value of its dependents.
          // console.log(
          //   "cellPlugin/apply()",
          //   "state=" + JSON.stringify(state, null, 2),
          //   "value=" + JSON.stringify(value, null, 2),
          //   "formState=" + JSON.stringify(formState, null, 2),
          // );
          if (lastFocusedCell && value.cells[lastFocusedCell]) {
            const cell = value.cells[lastFocusedCell];
            // Compute the value of `lastFocusedCell`.
            value = {
              ...value,
              blurredCell: lastFocusedCell,
              cells: {
                ...value.cells,
                [lastFocusedCell]: {
                  ...cell,
                  ...evalCell({env: value, name: lastFocusedCell}),
                },
              },
              dirtyCells: [
                ...value?.dirtyCells,
                lastFocusedCell,  // Order matters.
                ...(cell?.deps || []),
              ],
            };
            const deps = getCellDependencies({env: value, names: [lastFocusedCell]});
            value = deps.reduce((value, name) => {
              // Add as dependent to each dependency.
              const cell = value.cells[name];
              return cell && {
                ...value,
                cells: {
                  ...value.cells,
                  [name]: {
                    ...cell,
                    ...evalCell({env: value, name}),
                    deps: [
                      ...cell?.deps,
                      ...!cell.deps.includes(lastFocusedCell) && [lastFocusedCell] || [],
                    ],
                  },
                },
              } || value;
            }, value);
            value = cell.deps?.reduce((value, name) => {
              // Update the value of the dependents.
              const cell = value.cells[name];
              return cell && {
                ...value,
                cells: {
                  ...value.cells,
                  [name]: {
                    ...cell,
                    ...evalCell({env: value, name}),
                  },
                },
              } || value;
            }, value) || value;
          }
          value = {
            ...value,
            lastFocusedCell: node.attrs.name,
            focusedCell: node.attrs.name,
          };
          const cells = getResponses(value.cells);
          formState.apply({
            type: "response",
            args: {
              cells,
            },
          });
          // Dispatch update for changed cells and their dependents
          if (lastFocusedCell) {
            const changedCellNames = [
              lastFocusedCell,
              ...(value.cells[lastFocusedCell]?.deps || []),
            ];
            formState.apply({
              type: "update",
              args: {
                cells: getChangedCells(value.cells, changedCellNames),
              },
            });
          }
          // Apply focus action only for explicit (non-synthetic) cell focus changes
          if (node.attrs.name && !tr.getMeta("syntheticFocus")) {
            // Clear any row/column focus by setting cell focus
            formState.apply({
              type: "focus",
              args: {
                type: "cell",
                name: node.attrs.name,
              },
            });
          }
        } else if (isTableCellOrHeader(node) && node.attrs?.name) {
          const name = node.attrs.name;
          const text = node.textContent.trim();
          value = {
            ...value,
            blurredCell: null,
            focusedCell: null,
            dirtyCells: [],
            cells: {
              ...value.cells,
              [name]: {
                ...value.cells[name],
                ...evalCell({env: value, name}),
                text,
                formula: text,
                // TODO: Add normalized value to cell state
                // normalizedValue,
              },
            },
          };
        }
        const cellExprs = self.getState(state);
        const validation = formState.data?.validation || null;
        const decorations = applyModelRules(cellExprs, state, value, validation, formState);
        return {
          ...value,
          decorations,
        };
      }
    },
    props: {
      decorations(state) {
        return this.getState(state).decorations;
      },
      handleDOMEvents: {
        mousedown(view, event) {
          // Get the position in the document from the mouse event
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) return false;

          // Get the node at this position
          const $pos = view.state.doc.resolve(pos.pos);
          let cellNode = null;
          let cellName = null;

          // Find the table cell node
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (node.type.name === "table_cell") {
              cellNode = node;
              cellName = node.attrs.name;
              break;
            }
          }

          if (cellNode && cellName) {
            const currentFocus = formState.data.focus;

            // Handle shift-click for cell range selection
            if (event.shiftKey && currentFocus) {
              let startCell = null;

              if (currentFocus.type === "cell") {
                if (currentFocus.isRange && currentFocus.cells && currentFocus.cells.length > 0) {
                  // Use the first cell of the range as the anchor
                  startCell = currentFocus.cells[0];
                } else if (currentFocus.name && !currentFocus.name.includes(',')) {
                  // Single cell selected
                  startCell = currentFocus.name;
                }
              }

              if (startCell) {
                const rangeCells = getCellRange(startCell, cellName);

                if (rangeCells.length > 0) {
                  formState.apply({
                    type: "focus",
                    args: {
                      type: "cell",
                      name: rangeCells.join(','),  // Send as comma-separated list
                      cells: rangeCells,  // Also include array for internal use
                      isRange: true,  // Flag to indicate this is a range
                    },
                  });

                  // Update decorations
                  const tr = view.state.tr;
                  tr.setMeta("focusChanged", true);
                  view.dispatch(tr);

                  event.preventDefault();
                  return true;
                }
              }
            }

            // If there's row/column/sheet highlighting or multi-cell selection and we click on ANY cell (focused or not),
            // we should clear the highlighting
            if (currentFocus && (currentFocus.type === "row" || currentFocus.type === "column" || currentFocus.type === "sheet" ||
                (currentFocus.type === "cell" && currentFocus.isRange))) {
              // Check if this cell is in the highlighted area
              const cellColumn = cellName.match(/^([A-Z]+)/)?.[1];
              const cellRow = cellName.match(/(\d+)$/)?.[1];

              let isInHighlightedArea = false;
              if (currentFocus.type === "sheet") {
                // Any data cell click clears sheet focus
                isInHighlightedArea = true;
              } else if (currentFocus.type === "column") {
                // Clicking any cell in any of the highlighted columns
                const selectedColumns = currentFocus?.columns || (currentFocus?.name ? [currentFocus?.name] : []);
                if (cellColumn === currentFocus?.name || selectedColumns.includes(cellColumn)) {
                  isInHighlightedArea = true;
                }
              } else if (currentFocus.type === "row") {
                // Clicking any cell in the highlighted rows
                const selectedRows = currentFocus?.rows || (currentFocus?.name ? [currentFocus?.name] : []);
                if (cellRow === currentFocus?.name || selectedRows.includes(cellRow)) {
                  isInHighlightedArea = true;
                }
              } else if (currentFocus.type === "cell" && currentFocus.isRange && currentFocus.cells) {
                // Clicking any cell in the highlighted range
                if (currentFocus.cells.includes(cellName)) {
                  isInHighlightedArea = true;
                }
              }

              // If we're clicking on any cell in the highlighted area, clear the highlight
              if (isInHighlightedArea) {
                formState.apply({
                  type: "focus",
                  args: {
                    type: "cell",
                    name: cellName,
                  },
                });
                // Force a re-render by dispatching an empty transaction
                const tr = view.state.tr;
                tr.setMeta("focusCleared", true);
                view.dispatch(tr);
              }
            }
          }
          return false; // Allow normal event processing
        }
      }
    }
  });
  return self;
}

class ParagraphView {
  public dom;
  public contentDOM;
  private value = "";
  private textContent = "";
  private hasFocus = false;
  constructor(node, view) {
    view = view;
    this.dom = document.createElement("div");
    this.dom.className = "custom-paragraph";
    this.contentDOM = document.createElement("p");
    this.dom.appendChild(this.contentDOM);
    if (node.content.size == 0) this.dom.classList.add("empty")
  }
  update(node) {
    if (node.type.name !== "paragraph") {
      return false
    }
    this.dom.classList.remove("empty");
    if (this.hasFocus) {
      if (node.content.size > 0) {
        this.textContent = node.textContent;
        this.value = this.hasFocus && this.textContent.indexOf("sum") > 0 && "300" || this.textContent;
        this.contentDOM.textContent = this.textContent;
      } else {
        this.contentDOM.textContent = this.value || this.contentDOM.textContent;
        }
    } else {
      this.dom.classList.add("empty")
    }
    return true
  }
}

const buildCell = ({ col, row, attrs, colsAttrs }) => {
  colsAttrs = colsAttrs || {};
  const cell = row[col];
  let content;
  let colspan = 1;
  let rowspan = 1;
  const colwidth = col === "_" && [40] || (colsAttrs[col]?.width ? [colsAttrs[col].width] : null);
  // Check cell's own background-color first (from attrs), then column's, then row's
  let background = cell?.attrs?.['background-color'] || cell?.attrs?.backgroundColor ||
                   colsAttrs[col]?.['background-color'] || colsAttrs[col]?.backgroundColor ||
                   attrs?.['background-color'] || attrs?.backgroundColor;

  const { text } = cell || {};
  const textContent = text ? [
    {
      "type": "text",
      text: String(text),
    }
  ] : [];
  content = [
    {
      "type": "paragraph",
      "content": textContent
    }
  ];
  const isHeader = cell.type === "th";

  // Calculate dynamic height based on font size if present (but not for headers)
  let cellHeight = "auto"; // Default to auto height
  const fontSize = attrs?.['font-size'] || colsAttrs[col]?.['font-size'] || cell?.['font-size'];
  if (fontSize && !isHeader) {
    // Extract numeric value from font size
    const sizeMatch = fontSize.match(/(\d+(?:\.\d+)?)/);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      // Add minimal padding to font size for compact row height
      // Using 1.2x for tighter spacing (was 1.5x)
      cellHeight = `${Math.max(size * 1.2 + 4, 24)}px`; // size * 1.2 + 4px padding
    }
  }

  // Filter out font-size for header cells
  // Ensure we have valid objects to spread (handle undefined)
  // Also filter out backgroundColor from attrs as it's handled separately as 'background'
  const { backgroundColor: _bgColor, ...restAttrs } = attrs || {};
  const filteredAttrs = isHeader ? { ...restAttrs } : restAttrs;

  // Filter out background-color from column attrs as it's handled separately
  const { 'background-color': _colBg, backgroundColor: _colBgColor, ...restColsAttrs } = colsAttrs[col] || {};
  const filteredColsAttrs = isHeader ? { ...restColsAttrs } : restColsAttrs;

  // Extract only the attributes from the cell, excluding text and type
  const { text: _text, type: _type, attrs: cellAttrsObj, ...cellRest } = cell || {};
  // Filter out background properties from the cell's attrs since they're handled separately
  const { 'background-color': _cellBg, backgroundColor: _cellBgColor, background: _cellBgProp, ...filteredCellAttrs } = cellAttrsObj || {};
  const filteredCell = isHeader ? { ...(cell || {}) } : { ...cellRest, ...filteredCellAttrs };


  if (isHeader) {
    // Remove font-size related properties from headers
    delete filteredAttrs?.['font-size'];
    delete filteredAttrs?.fontSize;
    delete filteredColsAttrs?.['font-size'];
    delete filteredColsAttrs?.fontSize;
    delete filteredCell?.['font-size'];
    delete filteredCell?.fontSize;

    // Remove border properties from headers to prevent row/column borders from appearing on labels
    delete filteredAttrs?.border;
    delete filteredColsAttrs?.border;
  }

  const result = {
    "type": isHeader && "table_header" || "table_cell",
    "attrs": {
      name: `${col}${row._.text || 0}`,
      colspan,
      rowspan,
      colwidth,
      width: "50px",
      height: cellHeight,
      background,
      // Set readonly attribute for header cells
      readonly: isHeader ? "true" : null,
      ...filteredAttrs,  // Spread filtered row attributes
      ...filteredColsAttrs,  // Column attributes override row attributes
      ...filteredCell,  // Cell attributes override everything
    },
    "content": content,
  };


  return result;
};

const buildRow = ({ cols, row, attrs, colsAttrs }) => {
  return ({
    "type": "table_row",
    "content": cols.map(col => {
      return buildCell({col, row, attrs, colsAttrs});
    }),
  })
};

const buildTable = ({ cols, rows, attrs, colsAttrs }) => {
  return ({
    "type": "table",
    "content": rows.map((row, rowIndex) => {
      return buildRow({cols, row, colsAttrs, attrs: attrs[rowIndex]});
    })
  })
};

const buildDocFromTable = ({ cols, rows, colsAttrs, rowsAttrs }) => {
  const attrs = applyRules({ cols, rows, rowsAttrs });
  return {
    "type": "doc",
    "content": [
      {
        ...buildTable({cols, rows, attrs, colsAttrs}),
      },
    ]
  }
};

const applyRules = ({ cols, rows, rowsAttrs }) => {
  const argsCols = cols.slice(0, cols.length - 1);
//  const totalCol = cols[cols.length - 1];
  const rowAttrs = []
  rows.forEach((row, rowIndex) => {
    let total = 0;
    argsCols.forEach(col => {
      total += +row[col];
    });
    if (rowAttrs[rowIndex] === undefined) {
      rowAttrs[rowIndex] = {};
    }
    // Merge row attributes from rowsAttrs if available
    // rowIndex 0 is the header row (column labels)
    // rowIndex 1 is the first data row (labeled as row 1 in the spreadsheet)
    // rowIndex 2 is the second data row (labeled as row 2 in the spreadsheet)
    // rowsAttrs uses spreadsheet row numbers (1, 2, 3...) as keys
    if (rowsAttrs && rowsAttrs[rowIndex]) {
      rowAttrs[rowIndex] = { ...rowsAttrs[rowIndex] };
    }
    // Don't set a default background color - let cells use their natural background
  });
  return rowAttrs;
};

// Helper function to merge border specifications from multiple sources
const mergeBorders = (border1, border2) => {
  if (!border1) return border2;
  if (!border2) return border1;

  // If either is a CSS border string (e.g., "1px solid black"), use the most specific one
  if (border1.includes('px') || border2.includes('px')) {
    // Cell borders take precedence over column/row borders for CSS styles
    return border2;
  }

  // Parse side specifications
  const parseSides = (border) => {
    if (border === 'all') return ['top', 'bottom', 'left', 'right'];
    return border.split(',').map(s => s.trim().toLowerCase());
  };

  const sides1 = parseSides(border1);
  const sides2 = parseSides(border2);

  // Merge unique sides
  const mergedSides = [...new Set([...sides1, ...sides2])];

  // If all sides are present, return 'all'
  if (mergedSides.includes('top') && mergedSides.includes('bottom') &&
      mergedSides.includes('left') && mergedSides.includes('right')) {
    return 'all';
  }

  return mergedSides.join(',');
};

const getCell = (row, col, cells, columns, rows) => {
  if (row === 0 && col === "_") {
    return {
      type: "th",
      text: "",  // Empty text for top-left corner
      attrs: { readonly: "true" }
    };
  }
  if (col === "_" && row !== 0) {
    return {
      type: "th",
      text: row,
      attrs: { readonly: "true" }
    };
  }
  if (row === 0 && col !== "_") {
    return {
      type: "th",
      text: col,
      attrs: { readonly: "true" }
    };
  }
  if (row !== 0 && col !== "_") {
    const cellKey = `${col}${row}`;
    const cellData = cells[cellKey] || {};
    const columnData = columns && columns[col] || {};
    const rowData = rows && rows[row] || {};
    // Extract text separately to ensure it's not lost in attribute merging
    const { text, ...cellAttrs } = cellData;

    // Extract borders to merge them specially
    const rowBorder = rowData?.border;
    const columnBorder = columnData?.border;
    const cellBorder = cellAttrs?.border || cellData.attrs?.border;

    // Merge borders from all sources
    const mergedBorder = mergeBorders(mergeBorders(rowBorder, columnBorder), cellBorder);

    // Merge other attributes with spread operator (cell data takes precedence)
    const { border: _rb, ...rowAttrsNoBorder } = rowData;
    const { border: _cb, ...columnAttrsNoBorder } = columnData;
    const { border: _cellb, ...cellAttrsNoBorder } = cellAttrs;
    const { border: _cellAttrsb, ...cellDataAttrsNoBorder } = cellData.attrs || {};

    const mergedAttrs = {
      ...rowAttrsNoBorder,
      ...columnAttrsNoBorder,
      ...cellAttrsNoBorder,
      ...cellDataAttrsNoBorder,
      ...(mergedBorder ? { border: mergedBorder } : {})
    };


    return {
      type: "td",
      text: text || "",  // Explicitly preserve text property
      attrs: {
        // Extract attributes from merged attrs structure for ProseMirror
        underline: mergedAttrs?.underline,
        border: mergedAttrs?.border,
        'font-weight': mergedAttrs?.['font-weight'] || mergedAttrs?.fontWeight,
        fontWeight: mergedAttrs?.fontWeight || mergedAttrs?.['font-weight'], // Backward compatibility
        'font-size': mergedAttrs?.['font-size'] || mergedAttrs?.fontSize,
        fontSize: mergedAttrs?.fontSize || mergedAttrs?.['font-size'], // Backward compatibility
        'font-family': mergedAttrs?.['font-family'] || mergedAttrs?.fontFamily,
        fontFamily: mergedAttrs?.fontFamily || mergedAttrs?.['font-family'], // Backward compatibility
        'font-style': mergedAttrs?.['font-style'] || mergedAttrs?.fontStyle,
        fontStyle: mergedAttrs?.fontStyle || mergedAttrs?.['font-style'], // Backward compatibility
        color: mergedAttrs?.color,
        'text-decoration': mergedAttrs?.['text-decoration'] || mergedAttrs?.textDecoration,
        textDecoration: mergedAttrs?.textDecoration || mergedAttrs?.['text-decoration'], // Backward compatibility
        'vertical-align': mergedAttrs?.['vertical-align'] || mergedAttrs?.verticalAlign,
        verticalAlign: mergedAttrs?.verticalAlign || mergedAttrs?.['vertical-align'], // Backward compatibility
        background: mergedAttrs?.background,
        'background-color': mergedAttrs?.['background-color'] || mergedAttrs?.backgroundColor,
        backgroundColor: mergedAttrs?.backgroundColor || mergedAttrs?.['background-color'], // Backward compatibility
        align: mergedAttrs?.align || mergedAttrs?.justify,
        format: mergedAttrs?.format,
        assess: mergedAttrs?.assess,
        protected: mergedAttrs?.protected,
      },
    };
  }
  return {};
};

const makeEditorState = ({ type, columns, cells, rows }) => {
  if (!cells || Object.keys(cells).length === 0) {
    return null;
  }
  //x = x > 26 && 26 || x;  // Max col count is 26.
  const { x, y } = Object.keys(cells).reduce((dims, cellName) => {
    const x = letters.indexOf(cellName.slice(0, 1));
    const y = +cellName.slice(1);
    return {
      x: x > dims.x && x || dims.x,
      y: y > dims.y && y || dims.y,
    };
  }, {x: 0, y: 0});
  switch (type) {
  case "table": {
    const cols = Array.apply(null, Array(x + 1)).map((_, col) => letters[col])
    const rowsData = Array.apply(null, Array(y + 1)).map((_, row) =>
      cols.reduce((rowAccum, col) =>
        ({
          ...rowAccum,
          [col]: getCell(row, col, cells || {}, columns, rows)
        }), {}
      )
    );
    const doc = buildDocFromTable({
      cols,
      rows: rowsData,
      colsAttrs: columns,
      rowsAttrs: rows,
    });
    return {
      doc: doc,
      selection: {
        type: "text",
        anchor: 1,
        head: 1,
      },
    };
  }
  default:
    return null;
  }
};

export const TableEditor = ({ state, onEditorViewChange }) => {
  const { type, columns, cells, rows } = state.data.interaction;
  const [ editorView, setEditorView ] = useState(null);
  const [ tooltipState, setTooltipState ] = useState({ visible: false, x: 0, y: 0 });
  const tooltipHandler = {
    showTooltip: (event) => {
      // Try to get position from mouse event or element
      let x = 0, y = 0;
      if (event.clientX && event.clientY) {
        // Mouse event with coordinates
        x = event.clientX;
        y = event.clientY;
      } else {
        // Fallback to element bounds
        const rect = event.target?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0 };
        x = rect.left + (rect.width / 2);
        y = rect.top;
      }
      setTooltipState({
        visible: true,
        x,
        y,
      });
      // Auto-hide tooltip after 4 seconds
      setTimeout(() => {
        setTooltipState(prev => ({ ...prev, visible: false }));
      }, 4000);
    }
  };
  const cellPlugin = buildCellPlugin(state);
  const menuPlugin = buildMenuPlugin(state);
  const plugins = [
    columnResizing(),
    tableEditing(),
    history(),
    keymap({"Mod-z": undo, "Mod-y": redo}),
    keymap({
      ...baseKeymap,
      Tab: skipHeadersGoToNextCell(1),
      'Shift-Tab': skipHeadersGoToNextCell(-1),
      Enter: skipHeadersGoToNextCell(1),
      // Use simpler arrow handlers - let the plugin's keydown handler do the header prevention
    }),
    menuPlugin,
    //  modelBackgroundPlugin(),
    makeTableHeadersReadOnlyPlugin(state),
    makeProtectedCellsPlugin(tooltipHandler),
    cellPlugin,
  ];
  const editorRef = useRef(null);
  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    // Create initial state with data if available
    let initEditorState;
    if (cells && Object.keys(cells).length > 0) {
      const editorStateData = makeEditorState({type, columns, cells, rows});
      if (editorStateData) {
        initEditorState = EditorState.fromJSON({
          schema,
          plugins,
        }, editorStateData);
      } else {
        initEditorState = EditorState.create({
          schema,
          plugins,
        });
      }
    } else {
      initEditorState = EditorState.create({
        schema,
        plugins,
      });
    }
    const fix = fixTables(initEditorState);
    if (fix) initEditorState = initEditorState.apply(fix.setMeta('addToHistory', false));
    const editorView = new EditorView(editorRef.current, {
      state: initEditorState,
      dispatchTransaction(transaction) {
        const editorState = editorView.state.apply(transaction);
        editorView.updateState(editorState);
        // debouncedStateUpdate({
        //   state,
        //   editorState: editorState.toJSON()
        // });
      },
      nodeViews: {
        paragraph(node, view) { return new ParagraphView(node, view) }
      }
    });
    setEditorView(editorView);
    onEditorViewChange?.(editorView);
    return () => {
      if (editorView) {
        editorView.destroy();
      }
    };
  }, []);
  // const templateVariablesRecords = state.data.templateVariablesRecords || [];
  // const index = Math.floor(Math.random() * templateVariablesRecords.length);
  // const env = templateVariablesRecords[index];
  useEffect(() => {
    if (editorView && cells) {
      const editorStateData = makeEditorState({type, columns, cells, rows});
      if (!editorStateData) {
        // If no editor state data, create an empty state
        const newEditorState = EditorState.create({
          schema,
          plugins,
        });
        editorView.updateState(newEditorState);
        return;
      }
      const newEditorState = EditorState.fromJSON({
        schema,
        plugins,
      }, editorStateData);
      editorView.updateState(newEditorState);
      const { pos } = getCellNodeByName({state: newEditorState, name: "A1"});
      if (!pos) return;
      const resolvedPos = newEditorState.doc.resolve(pos + 1); // +1 to position cursor inside the cell
      editorView.dispatch(editorView.state.tr.setSelection(new TextSelection(resolvedPos)));
      // editorView.focus();
    }
  }, [editorView, columns, cells]);
  return (
    <>
      <div
        ref={editorRef}
        className="border border-gray-300 p-2 bg-white text-xs font-sans"
      />
      <ProtectedCellTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
      />
    </>
  );
};
