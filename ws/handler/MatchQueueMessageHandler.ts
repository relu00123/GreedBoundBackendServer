import { WebSocket } from "ws";
import { SocketMessage } from "../../types/common";
import { MatchQueueManager } from "../../services/managers/MatchQueueManager";


export class MatchQueueMessageHandler {
    public static handleMatchStartRequest(ws : WebSocket, msg : SocketMessage) :void {
        console.log("[MatchQueueMessageHandler.ts], handleMatchStartRequest Received");

        const MapNumericID = msg.Payload.MapNumericID;
        MatchQueueManager.getInstance().handleMatchStartRequest(ws, MapNumericID);
    }

    public static handleMatchCancelRequest(ws : WebSocket , msg : SocketMessage) : void {
        console.log("[MatchQueueMessageHandler.ts], handleMatchCancelRequest Received");

        const MapNumericID = msg.Payload.MapNumericID;
        MatchQueueManager.getInstance().handleMatchCancelRequest(ws, MapNumericID);
    }
}