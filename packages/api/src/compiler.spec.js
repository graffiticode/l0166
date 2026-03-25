import { compiler } from './compiler.js';

const compile = (code, data = {}) =>
  new Promise((resolve, reject) =>
    compiler.compile(code, data, {}, (err, val) => {
      if (err && err.length) {
        reject(err);
      } else {
        resolve(val);
      }
    })
  );

describe("compiler", () => {
  it("should put text in cell A1 using TAG cell name and STR text", async () => {
    const code = {
      "3": { "elts": ["A1"], "tag": "TAG" },
      "5": { "elts": ["A1"], "tag": "STR" },
      "6": { "elts": [], "tag": "RECORD" },
      "8": { "elts": ["v"], "tag": "TAG" },
      "9": { "elts": ["0.0.1"], "tag": "STR" },
      "10": { "elts": [8, 9], "tag": "BINDING" },
      "11": { "elts": [10], "tag": "RECORD" },
      "15": { "elts": [5, 6], "tag": "TEXT" },
      "17": { "elts": [3, 15], "tag": "CELL" },
      "19": { "elts": [17], "tag": "LIST" },
      "20": { "elts": [19, 11], "tag": "CELLS" },
      "22": { "elts": [20], "tag": "EXPRS" },
      "23": { "elts": [22], "tag": "PROG" },
      "root": 23
    };
    const result = await compile(code);
    expect(result.interaction.cells.A1.text).toBe("A1");
  });
});
