import { MapId, TeamJoinPolicy, TicketId } from "../../types/match";
import { PartyID, PartyMember } from "../../types/party";
import { ClientSocketMessageSender } from "../ClientSocketMessageSender";


export type QueueJoinedPayload = {
    mapId : number;
    policy : string;
    ticketId : string;
    partyId : number;
}

export type QueueCanceledPayload = {
    mapId : number;
    partyId : number;
}

export class MatchQueueNotificationService {

    public static notifyMatchQueueJoined(bisParty : boolean, MapId : MapId, target : string | PartyID, policy : TeamJoinPolicy, ticketId : TicketId) : void {

        const payload : QueueJoinedPayload  = {
            mapId : MapId,
            policy : String(policy),
            ticketId : String(ticketId),
            partyId : bisParty ? (target as PartyID) : 0
        };

        const message = {
            type : "QueueJoined",
            payload
        };

    
        if (bisParty) {
            ClientSocketMessageSender.broadcastToParty(target as PartyID, message);
        }

        else {
            ClientSocketMessageSender.sendToUser(target as string, message);
        }
    }

    public static notifyMatchQueueCanceled(bisParty : boolean, MapId : MapId, target : string | PartyID) {
        
        const payload : QueueCanceledPayload = {
            mapId : MapId,
            partyId : bisParty ? (target as PartyID) : 0
        };

        const message = {
            type : "QueueCanceled",
            payload
        };

        if (bisParty) {
            ClientSocketMessageSender.broadcastToParty(target as PartyID, message);
        }

        else {
            ClientSocketMessageSender.sendToUser(target as string, message);
        }

    }
}