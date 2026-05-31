export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function greet(name: string): ApiResponse<{ message: string }> {
  if (!name) return { success: false, error: "Name required" };
  return { success: true, data: { message: `Hello, ${name}!` } };
}

export function add(a: number, b: number): ApiResponse<{ result: number }> {
  return { success: true, data: { result: a + b } };
}
