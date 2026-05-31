export function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      result[key] = args[i + 1] || "";
      i++;
    }
  }
  return result;
}

export function formatOutput(data: unknown, format: "json" | "text" = "json"): string {
  if (format === "json") return JSON.stringify(data, null, 2);
  return String(data);
}
