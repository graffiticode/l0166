import LearnositySDK from "learnosity-sdk-nodejs";
import { randomUUID } from "node:crypto";

// Learnosity's public demo consumer. These are published in Learnosity's own docs and in
// every starter kit -- they are not secrets, and they only work against demo item banks.
// Override with LEARNOSITY_KEY / LEARNOSITY_SECRET to point at a real consumer.
const DEMO_KEY = "yis0TYCu7U9V4o7M";
const DEMO_SECRET = "74c5fd430cf1242a527f6223aebd42d30464be22";

const sdk = new LearnositySDK();

const key = process.env.LEARNOSITY_KEY || DEMO_KEY;
const secret = process.env.LEARNOSITY_SECRET || DEMO_SECRET;

const timestamp = () => {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
};

const security = (domain) => ({
  user_id: "testing_user",
  consumer_key: key,
  domain,
  timestamp: timestamp(),
});

/** Sign a Questions API request. Mirrors config.php's signAssessmentRequest. */
export const signAssessment = ({ domain, request }) =>
  sdk.init(
    "questions",
    security(domain),
    secret,
    {
      name: "test-name",
      course_id: "test-course",
      id: "test-id",
      type: "submit_practice",
      renderSaveButton: true,
      ...request,
    }
  );

/** Sign an Author API request. Mirrors config.php's signAuthoringRequest. */
export const signAuthoring = ({ domain, request }) =>
  sdk.init(
    "author",
    security(domain),
    secret,
    {
      mode: "item_edit",
      reference: randomUUID(),
      user: {
        id: "demos@learnosity.com",
        firstname: "Demo",
        lastname: "User",
      },
      ...request,
      config: {
        global: {
          item_edit: {
            item: {
              back: true,
              columns: true,
              answers: true,
              scoring: true,
              reference: { edit: false, show: false },
              save: true,
              status: false,
              dynamic_content: true,
              shared_passage: true,
            },
            widget: { delete: false, edit: false },
          },
        },
        ...request?.config,
        dependencies: {
          ...request?.config?.dependencies,
          question_editor_api: {
            ...request?.config?.dependencies?.question_editor_api,
            init_options: {
              ui: {
                search_field: true,
                layout: { global_template: "edit_preview", mode: "advanced" },
              },
              ...request?.config?.dependencies?.question_editor_api?.init_options,
            },
          },
        },
      },
    }
  );

export const consumerKey = key;
