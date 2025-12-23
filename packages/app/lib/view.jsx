import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Form } from "./components";
import { createState } from "./lib/state";
import { compile, getData } from './swr/fetchers';
import './index.css';

function isNonNullObject(obj) {
  return (
    typeof obj === "object" &&
      obj !== null
  );
}

/*
  View manages the state of the form. It may or may not use the server compiler
  to handle state transitions. Its interface with the host is through the url
  search parameters and message passing. This is to ensure that it can be
  embedded in an iframe or rendered in a blank browser window without losing any
  functionality.

  There are two basic actions that need to be reduced by state: `update` and
  `compile`. 'update' triggers a recompile, and 'compile' registers the result
  of the compile.

  'state' can handle other, more specific, actions but they should follow the
  basic pattern of triggering a compile on update.

  If either 'accessToken' or 'id' is undefined, then recompiles are skipped. In
  that case any state transitions that need to occur must be handled by other
  methods.

  If the parent origin is provided, the view will post the state data to it when
  it chanages.
*/

const replaceVariables = (str, env) => {
  Object.keys(env).forEach(key => {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    str = str.replace(re, env[key]);
  });
  return str;
}

const isNonNullNonEmptyObject = obj => (
  typeof obj === "object" &&
    obj !== null &&
    Object.keys(obj).length > 0
);

const resolveVariables = (obj, env) => (
  Object.keys(obj).reduce((obj, key) => {
    const val = obj[key];
    if (typeof obj[key] === "string") {
      obj[key] = replaceVariables(val, env);
    } else if (isNonNullNonEmptyObject(val)) {
      obj[key] = resolveVariables(val, env);
    }
    return obj;
  }, obj)
);

export const View = () => {
  const params = new URLSearchParams(window.location.search);
  const [ id, setId ] = useState(params.get("id"));
  const [ accessToken, setAccessToken ] = useState(params.get("access_token"));
  const [ targetOrigin, setTargetOrigin ] = useState(params.get("origin"));
  const [ doInit, setDoInit ] = useState(true);
  const [ doRecompile, setDoRecompile ] = useState(false);
  const [ state ] = useState(createState({}, (data, { type, args }) => {
    console.log(
      "L0166 state.apply()",
      "type=" + type,
      "args=" + JSON.stringify(args, null, 2),
      "data=" + JSON.stringify(data, null, 2),
    );
    switch (type) {
    case "init":
      return {
        ...args,
      };
    case "compile":
      // TODO Merge compile data with current state data.
      // return {
      //   ...data,
      //   ...args,
      // };
    case "response":
      return {
        ...data,
        ...args,
      };
    case "update":
      // Merge args.cells into interaction.cells
      if (args.cells && data.interaction) {
        const existingCells = data.interaction.cells || {};
        const updatedCells = Object.keys(args.cells).reduce((acc, name) => ({
          ...acc,
          [name]: {
            ...acc[name],
            text: args.cells[name].text,
            formattedValue: args.cells[name].formattedValue,
          },
        }), existingCells);
        const newData = {
          ...data,
          interaction: {
            ...data.interaction,
            cells: updatedCells,
          },
        };
        // Post full updated state to parent in expected format
        if (targetOrigin && id) {
          window.parent.postMessage({
            type: 'data-updated',
            itemId: id,
            data: newData,
          }, targetOrigin);
        }
        return newData;
      }
      return {
        ...data,
        ...args,
      };
    case "focus":
      // Handle cell or column focus changes
      // Extract value from the focused element in interaction data
      let focusValue = {};

      if (data.interaction && args.type) {
        const { type, name, startCell, endCell } = args;

        // Get value based on the type of focused element
        if (type === 'cell' && name) {
          if (name.includes(',')) {
            // Multiple cells selected (comma-separated list)
            const cellNames = name.split(',');
            focusValue = {};
            cellNames.forEach(cellName => {
              if (data.interaction.cells && data.interaction.cells[cellName.trim()]) {
                focusValue[cellName.trim()] = data.interaction.cells[cellName.trim()];
              }
            });
          } else if (data.interaction.cells && data.interaction.cells[name]) {
            // Single cell selected
            focusValue = data.interaction.cells[name];
          }
        } else if (type === 'column') {
          // Handle both single column (name) and multiple columns (columns array)
          if (args.columns && args.columns.length > 0) {
            // Multiple columns selected - collect all their values
            focusValue = {};
            args.columns.forEach(colName => {
              if (data.interaction.columns && data.interaction.columns[colName]) {
                focusValue[colName] = data.interaction.columns[colName];
              }
            });
          } else if (name && data.interaction.columns && data.interaction.columns[name]) {
            // Single column selected
            focusValue = data.interaction.columns[name];
          }
        } else if (type === 'row') {
          // Handle both single row (name) and multiple rows (rows array)
          if (args.rows && args.rows.length > 0) {
            // Multiple rows selected - collect all their values
            focusValue = {};
            args.rows.forEach(rowName => {
              if (data.interaction.rows && data.interaction.rows[rowName]) {
                focusValue[rowName] = data.interaction.rows[rowName];
              }
            });
          } else if (name && data.interaction.rows && data.interaction.rows[name]) {
            // Single row selected
            focusValue = data.interaction.rows[name];
          }
        } else if (type === 'sheet' && data.interaction.sheets && data.interaction.sheets[name]) {
          focusValue = data.interaction.sheets[name];
        }
      }

      // Ensure focusValue is never undefined
      if (focusValue === undefined) {
        focusValue = {};
      }

      if (targetOrigin) {
        // Prepare focus data with value
        const focusData = {...args, value: focusValue};
        if (args.type === 'column' && args.columns && args.columns.length > 0) {
          // For multi-column selection, join column names with commas
          focusData.name = args.columns.join(',');
        } else if (args.type === 'row' && args.rows && args.rows.length > 0) {
          // For multi-row selection, join row names with commas
          focusData.name = args.rows.join(',');
        }
        window.parent.postMessage({focus: focusData}, targetOrigin);
      }
      return {
        ...data,
        focus: args,
      };
    default:
      console.error(false, `Unimplemented action type: ${type}`);
      return data;
    }
  }));

  useEffect(() => {
    if (window.location.search) {
      const data = params.get("data");
      if (data) {
        state.apply({
          type: "update",
          args: JSON.parse(data),
        });
      }
    }
  }, [window.location.search]);

  useEffect(() => {
    // If `id` changes, then get data to init state.
    if (id) {
      setDoInit(true);
    }
  }, [id]);

  const initResp = useSWR(
    doInit && id && {
      accessToken,
      id,
    },
    getData
  );

  if (initResp.data) {
    const data = initResp.data;
    const templateVariablesRecords = data.templateVariablesRecords || [];
    const index = Math.floor(Math.random() * templateVariablesRecords.length);
    const env = templateVariablesRecords[index] || {};
    const args = resolveVariables(data, env);
    state.apply({
      type: "init",
      args: initResp.data,
    });
    setDoInit(false);
  }

  const compileResp = useSWR(
    doRecompile && accessToken && id && {
      accessToken,
      id,
      data: state.data,
    },
    compile
  );

  if (compileResp.data) {
    state.apply({
      type: "compile",
      args: compileResp.data,
    });
    setDoRecompile(false);
  }

  return (
    isNonNullObject(state.data) &&
      <Form state={state} /> ||
      <div />
  );
}
