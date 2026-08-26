/*globals require, module, __dirname*/
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const LANG = "0166";

const srcDir = path.resolve(__dirname, "src");

// Emit straight into the API's static directory. These filenames are the URLs registered
// against the custom question type in the Learnosity item bank, so they must not move.
const outDir = path.resolve(__dirname, "../../api/public");

// The authoring layout ships from the shared runtime with a placeholder for the language id.
const authoringLayout = require.resolve(
  "@graffiticode/learnosity-cqt/authoring-layout.html"
);

module.exports = {
  context: srcDir,
  entry: {
    question: "./question.js",
    scorer: "./scorer.js",
  },
  output: {
    path: outDir,
    filename: "[name].js",
    // Never enable `clean`. This directory also holds lexicon.js, spec.html, schema.json,
    // template.gc, usage-guide.md, training-examples.md and integrations/{qti,front} --
    // and the QTI bundle has no surviving source.
    clean: false,
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
    new CopyPlugin({
      patterns: [
        {
          from: authoringLayout,
          to: path.resolve(outDir, "authoring_custom_layout.html"),
          transform: (content) =>
            content.toString().replace(/__GC_LANG__/g, LANG),
        },
        {
          from: path.resolve(__dirname, "images"),
          to: path.resolve(outDir, "images"),
        },
      ],
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".json"],
    fallback: {
      os: false,
      crypto: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.(jsx|js)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env", "@babel/preset-react"],
            },
          },
        ],
      },
    ],
  },
};
