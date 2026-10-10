import path from "node:path";
import http from "http";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ".env"));
  } catch {
    try {
      process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
    } catch {
      // .env optional
    }
  }
}

import app from "./app";
import { logger } from "./lib/logger";
import { initSocketServer } from "./socket";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
initSocketServer(server);

server.listen(port, () => {
  logger.info({ port }, "HackMatrix API Server listening with Socket.IO enabled");
});
