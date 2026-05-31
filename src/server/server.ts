import * as http from "http";
import * as path from "path";
import { handleRequest, type ApiContext } from "./routes";

const PORT = parseInt(process.env.PORT || "3456", 10);
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();
const BASE_DIR = process.env.BASE_DIR || ".ai_runs";

const ctx: ApiContext = {
  rootDir: ROOT_DIR,
  baseDir: path.resolve(ROOT_DIR, BASE_DIR),
};

function readBody(req: http.IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) resolve(undefined);
      else resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    req.on("error", () => resolve(undefined));
  });
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = req.url || "/";

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const body = await readBody(req);
    const response = await handleRequest(method, url, body, ctx);

    if (typeof response.body === "string" && response.status === 200) {
      // HTML response for report
      res.writeHead(response.status, { "Content-Type": "text/html; charset=utf-8" });
      res.end(response.body);
    } else {
      res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(response.body));
    }
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`Multi-Agent Workflow API running on http://localhost:${PORT}`);
  console.log(`Root dir: ${ROOT_DIR}`);
  console.log(`Base dir: ${ctx.baseDir}`);
  console.log(`Provider: ${process.env.MODEL_PROVIDER || "mock"}`);
});

export { server };
