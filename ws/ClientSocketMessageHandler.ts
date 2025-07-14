import WebSocket, { WebSocketServer } from "ws";     
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { DungeonManager } from "../services/managers/DungeonManager";
import { SocketMessage } from "../types/types";


export function setupClientSocketMessageHandler(ws: WebSocket) {
  ws.on("message", (data) => {
    try {
      const msg: SocketMessage = JSON.parse(data.toString());

      switch(msg.type)
      {
        case "friend":
          // handleFriendMessage(ws, msg);

        default:
          ws.send(JSON.stringify({error : `Unknown message type : ${msg.type}`}));
      }
    } catch (err) {
      console.error("❌ [Client] Invalid message:", err);
    }
  });
}