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

  it("should omit interaction.hideMenu when hide-formulabar is not used", async () => {
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
    expect(result.interaction.hideMenu).toBeUndefined();
  });

  it("should set interaction.hideMenu when hide-formulabar true is used", async () => {
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
      "24": { "elts": [true], "tag": "BOOL" },
      "25": { "elts": [24, 20], "tag": "HIDE_FORMULABAR" },
      "22": { "elts": [25], "tag": "EXPRS" },
      "23": { "elts": [22], "tag": "PROG" },
      "root": 23
    };
    const result = await compile(code);
    expect(result.interaction.hideMenu).toBe(true);
    expect(result.interaction.cells.A1.text).toBe("A1");
  });
});

// There is no parser in this repo, so these tests hand-build the node pool the
// Graffiticode parser would emit, the same way the hide-formulabar test above
// does. The builders below just keep that readable.
const pool = () => {
  const nodes = {};
  let next = 1;
  const add = (tag, elts) => (nodes[next] = { elts, tag }, next++);
  return { nodes, add };
};

const version = (b) => b.add("RECORD", [
  b.add("BINDING", [b.add("TAG", ["v"]), b.add("STR", ["0.0.1"])]),
]);

const method = (b, m) => b.add("METHOD", [b.add("STR", [m])]);
const expected = (b, e) => b.add("EXPECTED", [b.add("STR", [e])]);
const points = (b, n) => b.add("POINTS", [b.add("NUM", [n])]);

// assess [...] {} — the trailing record is the continuation of the chain.
const assess = (b, members) => b.add("ASSESS", [
  b.add("LIST", members),
  b.add("RECORD", []),
]);

// cell <name> text <text> [assess [...]] {}
const cell = (b, name, text, members) => b.add("CELL", [
  b.add("TAG", [name]),
  b.add("TEXT", [
    b.add("STR", [text]),
    members ? assess(b, members) : b.add("RECORD", []),
  ]),
]);

// row <name> assess [...] {}
const row = (b, name, members) => b.add("ROW", [
  b.add("STR", [name]),
  assess(b, members),
]);

// column <name> assess [...] {}
const column = (b, name, members) => b.add("COLUMN", [
  b.add("TAG", [name]),
  assess(b, members),
]);

// Assemble `[rows [...]] cells [...] { v: "0.0.1" }..`
const program = ({ cells, rows = null, columns = null }) => {
  const b = pool();
  const cellIds = cells(b);
  let expr = b.add("CELLS", [b.add("LIST", cellIds), version(b)]);
  if (columns) {
    expr = b.add("COLUMNS", [b.add("LIST", columns(b)), expr]);
  }
  if (rows) {
    expr = b.add("ROWS", [b.add("LIST", rows(b)), expr]);
  }
  const root = b.add("PROG", [b.add("EXPRS", [expr])]);
  return { ...b.nodes, root };
};

const compileErrors = (code, data = {}) =>
  new Promise((resolve) =>
    compiler.compile(code, data, {}, (err) => resolve(err || []))
  );

describe("points", () => {
  it("defaults an assessed cell to 1 point and sets no points field", async () => {
    const result = await compile(program({
      cells: (b) => [
        cell(b, "A1", "100"),
        cell(b, "A3", "", [method(b, "value"), expected(b, "300")]),
      ],
    }));
    expect(result.validation.points).toBe(1);
    expect(result.interaction.cells.A3.assess.points).toBeUndefined();
  });

  it("reaches the compiled cell as assess.points", async () => {
    const result = await compile(program({
      cells: (b) => [
        cell(b, "D2", "", [method(b, "value"), expected(b, "836"), points(b, 2)]),
      ],
    }));
    expect(result.interaction.cells.D2.assess.points).toBe(2);
    expect(result.interaction.cells.D2.assess.expected).toBe("836");
    expect(result.interaction.cells.D2.assess.method).toBe("value");
  });

  it("sums authored points into the validation total", async () => {
    const result = await compile(program({
      cells: (b) => ["A1", "B1", "C1"].map(name =>
        cell(b, name, "", [method(b, "value"), expected(b, "1"), points(b, 2)])
      ),
    }));
    expect(result.validation.points).toBe(6);
  });

  it("keeps points 0 distinct from unset", async () => {
    const result = await compile(program({
      cells: (b) => [
        cell(b, "A1", "", [method(b, "value"), expected(b, "1"), points(b, 0)]),
        cell(b, "A2", "", [method(b, "value"), expected(b, "2"), points(b, 1)]),
      ],
    }));
    expect(result.interaction.cells.A1.assess.points).toBe(0);
    expect(result.validation.points).toBe(1);
  });

  it("accepts fractional points", async () => {
    const result = await compile(program({
      cells: (b) => [
        cell(b, "A1", "", [method(b, "value"), expected(b, "1"), points(b, 0.5)]),
        cell(b, "A2", "", [method(b, "value"), expected(b, "2"), points(b, 0.5)]),
      ],
    }));
    expect(result.validation.points).toBe(1);
  });

  it("counts nothing for cells with no assess", async () => {
    const result = await compile(program({
      cells: (b) => [cell(b, "A1", "100"), cell(b, "A2", "200")],
    }));
    expect(result.validation.points).toBe(0);
  });

  // R4: the error must surface even when `points` is not the first member of
  // the assess list, which is what the Checker.ASSESS member walk is for.
  it("rejects negative points in a trailing list position", async () => {
    const errors = await compileErrors(program({
      cells: (b) => [
        cell(b, "A1", "", [method(b, "value"), expected(b, "1"), points(b, -1)]),
      ],
    }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/E_INVALID_POINTS/);
  });

  it("rejects non-numeric points in a trailing list position", async () => {
    const errors = await compileErrors(program({
      cells: (b) => [
        cell(b, "A1", "", [
          method(b, "value"),
          expected(b, "1"),
          b.add("POINTS", [b.add("STR", ["two"])]),
        ]),
      ],
    }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/E_ARG_TYPE: POINTS/);
  });

  it("inherits points from a row region, with the cell overriding", async () => {
    const result = await compile(program({
      rows: (b) => [row(b, "*", [method(b, "value"), expected(b, "actual"), points(b, 2)])],
      cells: (b) => [
        cell(b, "A1", "", [method(b, "value"), expected(b, "1")]),
        cell(b, "A2", "", [method(b, "value"), expected(b, "2")]),
        cell(b, "A3", "", [method(b, "value"), expected(b, "3"), points(b, 3)]),
      ],
    }));
    expect(result.interaction.cells.A1.assess.points).toBe(2);
    expect(result.interaction.cells.A2.assess.points).toBe(2);
    expect(result.interaction.cells.A3.assess.points).toBe(3);
    expect(result.validation.points).toBe(7);
  });

  it("inherits points from a column when no row supplies them", async () => {
    const result = await compile(program({
      columns: (b) => [column(b, "B", [method(b, "value"), expected(b, "actual"), points(b, 4)])],
      cells: (b) => [
        cell(b, "B1", "", [method(b, "value"), expected(b, "1")]),
        cell(b, "B2", "", [method(b, "value"), expected(b, "2")]),
      ],
    }));
    expect(result.interaction.cells.B1.assess.points).toBe(4);
    expect(result.validation.points).toBe(8);
  });

  it("does not give points to unassessed cells in a weighted row", async () => {
    const result = await compile(program({
      rows: (b) => [row(b, "*", [method(b, "value"), expected(b, "actual"), points(b, 2)])],
      cells: (b) => [
        cell(b, "A1", "label"),
        cell(b, "B1", "", [method(b, "value"), expected(b, "1")]),
      ],
    }));
    expect(result.interaction.cells.A1.assess).toBeUndefined();
    expect(result.validation.points).toBe(2);
  });
});
