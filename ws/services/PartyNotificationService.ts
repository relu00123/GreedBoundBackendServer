import { PartyManager } from "../../services/managers/PartyManager";
import { PartyID, PartyMemberJoined, PartyMemberLeft, PartyHostTransferred, PartyMember } from "../../types/party";
import { ClientSocketMessageSender } from "../ClientSocketMessageSender";
import { WebSocket } from "ws";


/**
 * @description 파티 초대 응답 페이로드.
 */
interface PartyInviteResponsePayload {
    success: boolean;
    error?: string | null;
    inviteeName?: string | null;
}

/**
 * @description 파티 초대 수락 응답 페이로드.
 */
interface AcceptPartyInviteResponsePayload {
    success: boolean;
    error?: string | null;
    partyId?: PartyID | null;
    hostName?: string | null;
}

/**
 * @description 파티 생성 알림 페이로드.
 */
interface PartyCreatedNotificationPayload {
    partyId: PartyID;
    hostName: string;
}

// 특정 파티 정보를 클라이언트에게 전송할 때 사용되는 페이로드 인터페이스입니다.
// 이 인터페이스는 ClientSocketMessageSender에서 PartyInfoNotification을 전송할 때 사용됩니다.
export interface PartyInfoNotificationPayload {
    partyId: PartyID;
    hostName: string;
    members: PartyMember[];
}


export class PartyNotificationService {

    /**
     * @description 클라이언트에게 파티 초대 응답을 보냅니다.
     * @param ws 메시지를 보낼 웹소켓 인스턴스
     * @param payload 응답 페이로드 객체
     */
    public static sendPartyInviteResponse(ws: WebSocket, payload: PartyInviteResponsePayload): void {
        ClientSocketMessageSender.sendToSocket(ws, {
            type: "SendPartyInviteResponse",
            payload
        });
    }

    /**
     * @description 클라이언트에게 파티 초대 알림을 보냅니다.
     * @param ws 메시지를 보낼 웹소켓 인스턴스
     * @param inviterName 초대한 사람의 이름
     */
    public static sendPartyInviteNotification(ws: WebSocket, inviterName: string): void {
        ClientSocketMessageSender.sendToSocket(ws, {
            type: "PartyInviteNotification",
            payload: {
                inviterName
            }
        });
    }

    /**
     * @description 클라이언트에게 파티 초대 수락 응답을 보냅니다.
     * @param ws 메시지를 보낼 웹소켓 인스턴스
     * @param payload 응답 페이로드 객체
     */
    public static sendAcceptPartyInviteResponse(ws: WebSocket, payload: AcceptPartyInviteResponsePayload): void {
        ClientSocketMessageSender.sendToSocket(ws, {
            type: "AcceptPartyInviteResponse",
            payload
        });
    }

    // /**
    //  * @description 클라이언트에게 파티 생성 알림을 보냅니다.
    //  * @param ws 메시지를 보낼 웹소켓 인스턴스
    //  * @param payload 알림 페이로드 객체
    //  */
    // public static notifyPartyCreated(ws: WebSocket, payload: PartyCreatedNotificationPayload): void {
    //     ClientSocketMessageSender.sendToSocket(ws, {
    //         type: "PartyCreatedNotification",
    //         payload
    //     });
    // }

    /**
     * @description 파티에 멤버가 추가되었음을 모든 파티원에게 알립니다.
     * @param partyID 멤버가 추가된 파티의 ID
     * @param newMemberName 새로 추가된 멤버의 이름
     */
    public static notifyMemberJoined(partyID: PartyID, newMemberName: string, excludeNotifyMemberName? : string): void {
        const payload: PartyMemberJoined = {
            partyId: partyID,
            memberName: newMemberName,
        }

        ClientSocketMessageSender.broadcastToParty(partyID, {
            type: "PartyMemberJoined",
            payload: payload
        }, excludeNotifyMemberName);
    }

    /**
     * @description 파티에서 멤버가 탈퇴했음을 모든 파티원에게 알립니다.
     * @param partyID 멤버가 탈퇴한 파티의 ID
     * @param memberName 탈퇴한 멤버의 이름
     */
    public static notifyMemberLeft(partyID: PartyID, memberName: string, excludeNotifyMemberName? : string): void {
        const payload: PartyMemberLeft = {
            partyId: partyID,
            memberName: memberName,
        };
        ClientSocketMessageSender.broadcastToParty(partyID, {
            type: "PartyMemberLeft",
            payload: payload
        }, excludeNotifyMemberName);
    }

    /**
     * @description 특정 멤버에게 파티의 전체 정보를 보냅니다.
     * @param newMemberWs 새로 추가된 멤버의 웹소켓 인스턴스
     * @param partyID 파티 ID
     */
    public static sendPartyInfo(newMemberWs: WebSocket, partyID: PartyID): void {
        const party = PartyManager.getInstance().getParty(partyID);
        if (!party) {
            console.error(`Party with ID ${partyID} not found.`);
            return;
        }

        const partyInfoPayload: PartyInfoNotificationPayload = {
            partyId: party.partyId,
            hostName: party.hostName,
            members: party.members
        };
        ClientSocketMessageSender.sendToSocket(newMemberWs, {
            type: "PartyInfoNotification",
            payload: partyInfoPayload
        });
    }
    

    /**
     * @description 파티의 호스트가 변경되었음을 모든 파티원에게 알립니다.
     * @param partyID 호스트가 변경된 파티의 ID
     * @param oldHostName 이전 호스트의 이름
     * @param newHostName 새로운 호스트의 이름
     */
    public static notifyHostTransferred(partyID: PartyID, oldHostName: string, newHostName: string): void {
        const payload: PartyHostTransferred = {
            partyId: partyID,
            oldHostName: oldHostName,
            newHostName: newHostName,
        };
        ClientSocketMessageSender.broadcastToParty(partyID, {
            type: "PartyHostTransferred",
            payload: payload
        });
    }


}