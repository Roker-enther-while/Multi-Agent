import { strict as assert } from "node:assert";
import { test, describe } from "node:test";
import {
  getHealth,
  getUserById,
  createUser,
  getRequestCount,
  formatUserResponse,
  type User,
} from "../src/app.js";

describe("getHealth", () => {
  test("returns status ok", () => {
    const result = getHealth();
    assert.equal(result.status, "ok");
    assert.ok(typeof result.uptime === "number");
  });
});

describe("getUserById", () => {
  test("returns existing user", () => {
    const result = getUserById(1);
    assert.equal(result.success, true);
    assert.equal(result.data?.name, "Alice");
    assert.equal(result.data?.email, "alice@example.com");
  });

  test("returns error for non-existent user", () => {
    const result = getUserById(999);
    assert.equal(result.success, false);
    assert.equal(result.error, "User not found");
  });
});

describe("createUser", () => {
  test("creates a new user", () => {
    const result = createUser("Charlie", "charlie@example.com");
    assert.equal(result.success, true);
    assert.equal(result.data?.name, "Charlie");
    assert.equal(result.data?.email, "charlie@example.com");
    assert.ok(typeof result.data?.id === "number");
  });

  test("rejects empty name", () => {
    const result = createUser("", "test@example.com");
    assert.equal(result.success, false);
    assert.equal(result.error, "Name and email are required");
  });

  test("rejects empty email", () => {
    const result = createUser("Dave", "");
    assert.equal(result.success, false);
    assert.equal(result.error, "Name and email are required");
  });
});

describe("formatUserResponse", () => {
  test("formats user as name <email>", () => {
    const user: User = { id: 1, name: "Alice", email: "alice@example.com" };
    assert.equal(formatUserResponse(user), "Alice <alice@example.com>");
  });
});
