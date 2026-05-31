export interface User {
  id: number;
  name: string;
  email: string;
}

export interface HealthStatus {
  status: string;
  uptime: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const users: Map<number, User> = new Map([
  [1, { id: 1, name: "Alice", email: "alice@example.com" }],
  [2, { id: 2, name: "Bob", email: "bob@example.com" }],
]);

let requestCount = 0;
const startTime = Date.now();

export function getHealth(): HealthStatus {
  return {
    status: "ok",
    uptime: Date.now() - startTime,
  };
}

export function getUserById(id: number): ApiResponse<User> {
  requestCount++;
  const user = users.get(id);
  if (!user) {
    return { success: false, error: "User not found" };
  }
  return { success: true, data: user };
}

export function createUser(name: string, email: string): ApiResponse<User> {
  requestCount++;
  if (!name || !email) {
    return { success: false, error: "Name and email are required" };
  }
  const id = users.size + 1;
  const user: User = { id, name, email };
  users.set(id, user);
  return { success: true, data: user };
}

export function getRequestCount(): number {
  return requestCount;
}

export function formatUserResponse(user: User): string {
  return `${user.name} <${user.email}>`;
}
