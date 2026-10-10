import { Server as HttpServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { logger } from "./lib/logger";

let io: SocketIOServer | null = null;

export type AuthorizeAdminSocket = (
  token: string,
  headers: Socket["handshake"]["headers"],
) => Promise<boolean>;

export function initSocketServer(
  httpServer: HttpServer,
  allowedOrigins: string[],
  authorizeAdminSocket: AuthorizeAdminSocket,
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      next(new Error("UNAUTHENTICATED"));
      return;
    }
    void authorizeAdminSocket(token, socket.handshake.headers)
      .then((authorized) => {
        if (!authorized) {
          next(new Error("FORBIDDEN"));
          return;
        }
        next();
      })
      .catch(() => next(new Error("UNAUTHENTICATED")));
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket.IO client connected to Admin Analytics stream");

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Socket.IO client disconnected");
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
