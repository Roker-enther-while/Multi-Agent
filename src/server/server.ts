/**
 * SERVER — HTTP server (không dùng Express/framework)
 *
 * [1] Nguồn tham khảo:
 *   - Node.js HTTP server (Node.js docs): http.createServer()
 *   - CORS headers (MDN Web Docs)
 *   - Static file serving (standard web server pattern)
 *
 * [2] Điểm khác biệt:
 *   - Không dùng Express — routing hoàn toàn manual trong routes.ts
 *   - readBody() tự implement streaming chunks
 *   - Kết hợp static file serving + API routing trong 1 callback
 *
 * [3] Mục tiêu: HTTP server phục vụ Web UI + API cho workflow
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { handleRequest, type ApiContext } from "./routes";

const PORT = parseInt(process.env.PORT || "3456", 10);
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();
const BASE_DIR = process.env.BASE_DIR || ".ai_runs";

const ctx: ApiContext = {
  rootDir: ROOT_DIR,
  baseDir: path.resolve(ROOT_DIR, BASE_DIR),
};

/**
 * Đọc HTTP request body thành string
 * [1] Nguồn: Node.js stream pattern
 * [2] Khác biệt: Tự implement (không dùng body-parser library)
 * [3] Mục tiêu: Đọc body từ POST requests
 */
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

const PUBLIC_DIR = path.resolve(__dirname, "../../server/public");

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = req.url || "/";
  let filePath = url === "/" ? "/index.html" : url;
  filePath = path.resolve(PUBLIC_DIR, "." + filePath);
  const normalizedPublic = path.resolve(PUBLIC_DIR);
  const normalizedFile = path.resolve(filePath);

  if (!fs.existsSync(normalizedFile) || !normalizedFile.startsWith(normalizedPublic)) return false;

  const ext = path.extname(filePath);
  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  res.end(content);
  return true;
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

  // Serve static files for non-API routes
  if (!url.startsWith("/api/")) {
    if (serveStatic(req, res)) return;
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
