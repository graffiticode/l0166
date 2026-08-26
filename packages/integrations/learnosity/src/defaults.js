/**
 * Fallback envelope for a question that carries no authored data, or data that will not
 * parse. Shared by the Question and the Scorer so both degrade to the same empty sheet.
 */
export const defaultData = {
  validation: { points: 0, ranges: {}, cells: {} },
  interaction: { type: "table", v: "0.0.1", cells: {}, columns: {} },
};
