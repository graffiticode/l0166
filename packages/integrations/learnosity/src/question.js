import { createQuestion } from "@graffiticode/learnosity-cqt";
import { Form, scoreCells, getCellsValidation } from "@graffiticode/l0166";

import "@graffiticode/l0166/style.css";
import "@graffiticode/learnosity-cqt/styles.css";

import { defaultData } from "./defaults.js";

const Question = createQuestion({
  Form,
  scoreCells,
  getCellsValidation,
  defaultData,
});

/*global LearnosityAmd*/
LearnosityAmd.define([], function () {
  return {
    Question,
  };
});
