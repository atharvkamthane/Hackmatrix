import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./lib/logger";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket.IO client connected to Admin Analytics stream");

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Socket.IO client disconnected");
    });
  });

  // Emit periodic aggregate analytics updates every 15 seconds
  setInterval(() => {
    if (io) {
      const payload = {
        timestamp: new Date().toISOString(),
        eventType: "AGGREGATE_REFRESH",
        summaryMessage: "Live public-health aggregate surveillance dataset updated.",
        affectedRegions: ["Maharashtra", "Delhi NCR"],
        aggregateDelta: {
          category: "Respiratory",
          casesCount: 1940,
          suppressed: false,
        },
      };

      io.emit("analytics:update", payload);
      logger.info("Emitted analytics:update to connected clients");
    }
  }, 15000);

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
