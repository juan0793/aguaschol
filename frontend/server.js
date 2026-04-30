import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(rootDir, "dist");
const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

// Servidor estatico usado por Railway para publicar el frontend compilado.
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const resolveRequestPath = (urlPath) => {
  const normalizedPath = decodeURIComponent(urlPath.split("?")[0]);
  const requestedPath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  return path.resolve(distDir, `.${safePath}`);
};

const sendFile = async (filePath, res) => {
  const extension = path.extname(filePath).toLowerCase();
  const content = await fs.readFile(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
  });
  res.end(content);
};

const server = http.createServer(async (req, res) => {
  try {
    const filePath = resolveRequestPath(req.url ?? "/");

    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        await sendFile(filePath, res);
        return;
      }
    } catch {
      // Fall through to SPA entry.
    }

    await sendFile(path.resolve(distDir, "index.html"), res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`No fue posible servir el frontend: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`Frontend ejecutandose en http://${host}:${port}`);
});
