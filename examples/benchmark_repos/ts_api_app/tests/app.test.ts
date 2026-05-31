import { strict as assert } from "node:assert";
import { test, describe } from "node:test";
import { greet, add } from "../src/app.js";

describe("greet", () => {
  test("returns greeting", () => {
    const result = greet("World");
    assert.equal(result.success, true);
    assert.equal(result.data?.message, "Hello, World!");
  });

  test("rejects empty name", () => {
    const result = greet("");
    assert.equal(result.success, false);
  });
});

describe("add", () => {
  test("adds two numbers", () => {
    const result = add(2, 3);
    assert.equal(result.success, true);
    assert.equal(result.data?.result, 5);
  });
});
