/**
 * Local harness for the L0166 Learnosity custom question type.
 *
 * Replaces the PHP pages that used to live in artcompiler/learnosity-integrations. It
 * serves the real built bundles out of packages/api/public, so what you exercise here is
 * exactly what Learnosity will load.
 *
 *   npm run -w packages/integrations/learnosity demo
 *
 * Env:
 *   PORT                  default 12345
 *   LEARNOSITY_ENV        "staging" (default) or "production"
 *   LEARNOSITY_KEY/SECRET override the public demo consumer
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { signAssessment, signAuthoring, consumerKey } from "./sign.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const publicDir = path.resolve(root, "../../api/public");

const PORT = process.env.PORT || 12345;

// The PHP harness was inconsistent: assessment.php pointed at questions.staging while
// authoring.php pointed at production authorapi. Pick one deliberately here.
const ENV = process.env.LEARNOSITY_ENV || "staging";
const hosts =
  ENV === "production"
    ? { questions: "questions.learnosity.com", author: "authorapi.learnosity.com" }
    : {
        questions: "questions.staging.learnosity.com",
        author: "authorapi.staging.learnosity.com",
      };

const read = (p) => fs.readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));

// Inline JSON into a <script> block. `<` must be escaped or a "</script>" inside the
// value ends the block early -- the PHP harness got this for free, because PHP's
// json_encode escapes "/" by default.
const scriptJson = (value) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

const demoCss = () => read(path.join(here, "demo.css"));
const clientScript = (name) => read(path.join(here, "client", name));

const app = express();

// Serve the built bundles at /dist so the fixture's "/dist/question.js" paths resolve
// exactly as they are written.
app.use("/dist", express.static(publicDir));

app.get("/", (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<meta charset="UTF-8"><title>L0166 Learnosity demo</title>
<style>${demoCss()}</style>
<h1>L0166 Learnosity custom question type</h1>
<ul>
  <li><a href="/assessment">Questions API</a> &mdash; render and score the question</li>
  <li><a href="/authoring">Author API</a> &mdash; author an item via the Graffiticode editor</li>
</ul>
<p>Learnosity environment: <code>${ENV}</code> &middot; consumer <code>${consumerKey}</code></p>
<p>Bundles served from <code>${publicDir}</code></p>`);
});

app.get("/assessment", (req, res) => {
  const sessionId = req.query.session_id || randomUUID();
  const state = req.query.state || "initial";
  const responseId = `custom-${sessionId}`;

  const request = JSON.parse(
    JSON.stringify(readJson(path.join(here, "fixtures/assessment.json")))
      .replaceAll("__STATE__", state)
      .replaceAll("__SESSION_ID__", sessionId)
      .replaceAll("__RESPONSE_ID__", responseId)
  );

  const signed = signAssessment({ domain: req.hostname, request });

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Questions API &mdash; L0166</title>
<script src="//${hosts.questions}"></script>
<style>${demoCss()}</style>
</head>
<body>
<div class="client-question-info">Response ID: <code>${responseId}</code></div>
<span class="learnosity-response question-${responseId}"></span>
<div class="client-save-wrapper"><span class="learnosity-save-button"></span></div>
<div id="redirect_response" class="client-hidden">
  Save Successful! Do you want to go to
  <button type="button" class="client-btn" data-action="resume">Resume</button> or
  <button type="button" class="client-btn" data-action="review">Review</button> mode ?
</div>
<div class="client-request-json">
  <div><b>Request init options</b></div>
  <textarea readonly></textarea>
</div>
<script>
window.activity = ${scriptJson(signed)};
window.questionsApp = LearnosityApp.init(activity, {
  readyListener() { console.log('ready'); },
  errorListener(e) { console.error(e); },
  saveSuccess(responseIds) {
    console.log('save success', responseIds);
    if (window.__onSaveSuccess) { window.__onSaveSuccess(responseIds); }
  },
});
${clientScript("assessment.js")}
</script>
</body>
</html>`);
});

app.get("/authoring", (req, res) => {
  const initOptions = readJson(path.join(root, "question_editor_init_options.json"));
  const layout = read(path.join(publicDir, "authoring_custom_layout.html"));

  const signed = signAuthoring({
    domain: req.hostname,
    request: {
      config: {
        dependencies: { question_editor_api: { init_options: initOptions } },
      },
    },
  });

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Author API &mdash; L0166</title>
<script src="//${hosts.author}"></script>
<style>${demoCss()}</style>
</head>
<body>
<div id="learnosity-author"></div>
<div>
  <div class="client-request-json" data-type="initOptions">
    <div><b>Request init options</b></div><textarea readonly></textarea>
  </div>
  <div class="client-request-json" data-type="htmlLayout">
    <div><b>Custom Question HTML Layout</b></div><textarea readonly></textarea>
  </div>
</div>
<script>
window.activity = ${scriptJson(signed)};
window.authorApp = LearnosityAuthor.init(activity, {
  readyListener() { console.log('ready'); },
  errorListener(e) { console.error(e); },
});
document.querySelector('[data-type="initOptions"] > textarea').value =
  JSON.stringify(window.activity, null, 2);
document.querySelector('[data-type="htmlLayout"] > textarea').value =
  ${scriptJson(layout)};
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`L0166 Learnosity demo -> http://localhost:${PORT}`);
  console.log(`  bundles: ${publicDir}`);
  console.log(`  learnosity env: ${ENV}`);
});
