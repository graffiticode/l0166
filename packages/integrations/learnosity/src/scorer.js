// Kept free of React and of the renderer: Learnosity also runs this bundle server-side.
import { createScorer } from "@graffiticode/learnosity-cqt";
import { scoreCells } from "@graffiticode/l0166";

import { defaultData } from "./defaults.js";

const Scorer = createScorer({ scoreCells, defaultData });

/*global LearnosityAmd*/
LearnosityAmd.define([], function () {
  return {
    Scorer,
  };
});
