
import { WebSocket } from "ws";
import { PlayerManager } from "../services/managers/PlayerManager";

export class BroadcastSocketMessageUtils {
    static broadcastToAllLobbyMemberExceptSender(sender : WebSocket, message : any) {
        const allSessions = PlayerManager.getInstance("BroadcastSocketMessageUtils").GetAllPlayerSession();
        const data = JSON.stringify(message);

        for (const session of allSessions) {
            const ws = session.ws;
            if (!ws || ws === sender || ws.readyState !== WebSocket.OPEN) continue;
            ws.send(data);
        }
    }

     static broadcastToAllLobbyMember(message: any) {
        const allSessions = PlayerManager.getInstance("BroadcastSocketMessageUtils").GetAllPlayerSession();
        const data = JSON.stringify(message);

        for (const session of allSessions) {
            const ws = session.ws;
            if (!ws || ws.readyState !== WebSocket.OPEN) continue;
            ws.send(data);
        }
    }
}