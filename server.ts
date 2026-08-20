import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON parsing middleware
  app.use(express.json({ limit: "50mb" }));

  // Health check endpoint for Cloud Run
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const distPath = path.join(process.cwd(), "dist");
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (fs.existsSync(path.join(distPath, "index.html")) && !process.env.VITE_DEV_SERVER);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
