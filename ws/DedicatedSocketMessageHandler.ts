import WebSocket, { WebSocketServer } from "ws";     // ✔ 실제 모듈 import
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { DungeonManager } from "../services/managers/DungeonManager";
import { SocketMessage } from "../types/types";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";

 

export function setupDedicatedSocketMessageHandler(ws : WebSocket) {
  ws.on("message", (data) => {
    try {
      const msg: SocketMessage = JSON.parse(data.toString());
       GlobalJobQueue.execute(async() => {

        switch (msg.type) {
          case "escape_request":
            const escapeMsg = msg as unknown as EscapeRequestMessage;
            handleEscapeRequest(ws, escapeMsg);
            break;

          default:
            console.warn("⚠️ Unknown server message type:", msg.type);
            break;
        }
    });
    } catch (err) {
      console.error("❌ [Dedicated] Invalid message:", err);
    }
  });
}