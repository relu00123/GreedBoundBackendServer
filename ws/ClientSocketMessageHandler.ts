import WebSocket, { WebSocketServer } from "ws";     
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { DungeonManager } from "../services/managers/DungeonManager";
import { SocketMessage } from "../types/types";
import { PlayerManager } from "../services/managers/PlayerManager";


export function setupClientSocketMessageHandler(ws: WebSocket) {
  ws.on("message", (data) => {
    try {
      const msg: SocketMessage = JSON.parse(data.toString());

      switch(msg.type)
      {
        case "friend":
          // handleFriendMessage(ws, msg);
          break;

        case "LobbyUserListRequest":
          console.log("LobbyUserListRequest Received");

          const users = PlayerManager.getInstance("ClientSocketMessageHandler").getAllLobbyUserNameAndClass();

           console.log("🧍 Currently Connected Users:");
            users.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.username} (${user.classType})`);
          });

          ws.send(JSON.stringify({
            type: "LobbyUserListResponse",
            payload : users
          }))
          break;

        case "FriendListRequest":
          console.log("FriendListRequest Received");
          break;
          
        default:
          ws.send(JSON.stringify({error : `Unknown message type : ${msg.type}`}));
          break;
      }
    } catch (err) {
      console.error("❌ [Client] Invalid message:", err);
    }
  });
}