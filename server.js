// خادم محلي بسيط بلا أي مكتبات: npm start ثم افتح http://localhost:8080
// npm run start:lan  ← لفتحه من هاتف متصل بنفس شبكة الـ Wi-Fi
import http from "node:http";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = +process.env.PORT || 8080;
const LAN = process.argv.includes("--lan");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

http
  .createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = resolve(ROOT, "." + path);
      if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep) || /[\\/](node_modules|tests)[\\/]/.test(file)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  })
  .listen(PORT, LAN ? "0.0.0.0" : "127.0.0.1", () => {
    console.log(`\n  📖 QURAN MEMORISATION\n  → http://localhost:${PORT}`);
    if (LAN) {
      for (const list of Object.values(os.networkInterfaces())) {
        for (const a of list || []) if (a.family === "IPv4" && !a.internal) console.log(`  → http://${a.address}:${PORT}  (من الهاتف)`);
      }
    }
    console.log("");
  });
