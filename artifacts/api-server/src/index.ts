import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocketServer } from "./socket";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
initSocketServer(server);

server.listen(port, () => {
  logger.info({ port }, "HackMatrix API Server listening with Socket.IO enabled");
});
