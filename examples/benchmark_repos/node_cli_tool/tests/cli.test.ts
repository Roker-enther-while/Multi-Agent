import { strict as assert } from "node:assert";
import { test, describe } from "node:test";
import { parseArgs, formatOutput } from "../src/cli.js";

describe("parseArgs", () => {
  test("parses flags", () => {
    const result = parseArgs(["--name", "test", "--verbose"]);
    assert.equal(result.name, "test");
    assert.equal(result.verbose, "");
  });

  test("handles empty args", () => {
    const result = parseArgs([]);
    assert.deepEqual(result, {});
  });
});

describe("formatOutput", () => {
  test("formats as JSON", () => {
    const result = formatOutput({ a: 1 }, "json");
    assert.equal(result, '{\n  "a": 1\n}');
  });

  test("formats as text", () => {
    const result = formatOutput("hello", "text");
    assert.equal(result, "hello");
  });
});
