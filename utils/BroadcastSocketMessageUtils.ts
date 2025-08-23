
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

    static broadcastToSpecificMembers(members: string[], message : string) : void {
        const playerManager = PlayerManager.getInstance("BroadcastSocketMessageUtils");

        for (const memberName of members) {
            const playerSession = playerManager.getPlayerSessionByUserName(memberName);

             if (playerSession && playerSession.ws && playerSession.ws.readyState === WebSocket.OPEN) {
                playerSession.ws.send(message);
            }
        }
    }
}