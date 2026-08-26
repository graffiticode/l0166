/**
 * Regenerate demo/fixtures/assessment.json's `data` from demo/fixtures/assessment.gc.
 *
 *   npm run -w packages/integrations/learnosity demo:fixture
 *
 * The fixture this replaced was captured by hand years ago and had gone stale in a way nothing
 * caught: it carried the legacy envelope (`validation.ranges`, cell properties wrapped in
 * `attrs`), for which getCellsValidation returns NOTHING. The demo rendered, Check Answer
 * "worked", and the score was silently always 0 — the question could not be answered correctly.
 *
 * Compiling from source keeps `data` in whatever shape the compiler currently emits, which is
 * also the shape L0176 puts in a real item.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parser } from "@graffiticode/parser";

import { compiler } from "../../../api/src/compiler.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const gcFile = path.join(here, "fixtures/assessment.gc");
const jsonFile = path.join(here, "fixtures/assessment.json");
const lexicon = JSON.parse(
  readFileSync(path.resolve(here, "../../../api/dist/lexicon.json"), "utf8"),
);

const pool = await parser.parse(166, readFileSync(gcFile, "utf8"), lexicon);
const compiled = await new Promise((resolve, reject) =>
  compiler.compile(pool, {}, {}, (err, out) => {
    const errors = Array.isArray(err) ? err.filter(Boolean) : err ? [err] : [];
    errors.length ? reject(errors.map((e) => e?.message ?? String(e))) : resolve(out);
  }),
);

const assessed = Object.entries(compiled.interaction?.cells ?? {}).filter(([, c]) => c.assess);
if (!assessed.length) {
  throw new Error("compiled fixture has no assessed cells — the demo could not score");
}

const fixture = JSON.parse(readFileSync(jsonFile, "utf8"));
// Learnosity round-trips `data` as a string; so does L0176.
fixture.questions[0].data = JSON.stringify(compiled);
writeFileSync(jsonFile, JSON.stringify(fixture, null, 2) + "\n");

console.log(
  `demo fixture: ${assessed.length} assessed cells (${assessed.map(([k]) => k).join(", ")}), ` +
    `${compiled.validation.points} points`,
);
