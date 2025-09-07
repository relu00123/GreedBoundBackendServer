import { Socket } from "dgram";
import { PlayerManager } from "../../services/managers/PlayerManager";
import { SocketMessage } from "../../types/common";
import { ClientSocketMessageSender } from "../ClientSocketMessageSender";
import { WebSocket } from 'ws';
import { PartyID } from "../../types/party";
import { PartyManager } from "../../services/managers/PartyManager";
import { PartyNotificationService } from "../services/PartyNotificationService";
import { parseClientGamePhase } from "../../constants/ClientGamePhase";


export class GamePhaseMessageHandler {

    public static handleGamePhaseChangeRequest(ws: WebSocket, msg: SocketMessage): void {
        console.log("GamePhaseChange Request Received in GamePhaseMessageHandler");

        const NewPhaseRaw = msg.Payload.NewPhase;
        const parsedPhase = parseClientGamePhase(NewPhaseRaw);
        if (!parsedPhase) {
            console.warn(`Invalid GamePhase Received : ${NewPhaseRaw}`);
            return;
        }
        
        PlayerManager.getInstance("GamePhaseMessageHandler").handleGamePhaseChangeRequset(ws, parsedPhase);
    }

}