import { PartyManager } from "../../services/managers/PartyManager";
import { PartyID, PartyMemberJoined, PartyMemberLeft, PartyHostTransferred, PartyMember } from "../../types/party";
import { ClientSocketMessageSender } from "../ClientSocketMessageSender";
import { WebSocket } from "ws";
import { PartyInviteResult } from "../../types/party";


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

export interface PartyJoinedPayload {
    partyId : PartyID;
    hostName : string;
    members : PartyMember[];
}


export class PartyNotificationService {

    /**
    * @description (헬퍼) 특정 파티의 최신 PartyInfoNotificationPayload 생성
    */
    private static buildPartyInfoPayload(partyID: PartyID): PartyInfoNotificationPayload | null {
    const party = PartyManager.getInstance().getParty(partyID);
    if (!party) return null;

    return {
      partyId: party.partyId,
      hostName: party.hostName,
      members: party.members
    };
    }

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
     * @description 초대를 보낸 사람에게 ack사인을 보냅니다.
     * @param ws 메세지를 보낼 웹소켓 인스턴스
     * @param partyInviteResult 파티 초대에 대한 ack 정보 
     */
    public static sendPartyInviteAck(ws: WebSocket, partyInviteResult : PartyInviteResult) : void {
        ClientSocketMessageSender.sendToSocket(ws, {
            type : "PartyInviteAck",
            payload : {
                partyInviteResult
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

    public static notifyMemberLeftToSelf(targetWs: WebSocket, partyID: PartyID, memberName: string) {
        const payload: PartyMemberLeft = { partyId: partyID, memberName };
        ClientSocketMessageSender.sendToSocket(targetWs, { type: "PartyMemberLeft", payload });
    }

    /**
     * @description 파티에서 멤버가 추방되었음을 모든 파티원에게 알립니다.
     * @param partyID 추방이 일어난 파티의 ID
     * @param kickedMemberName 추방된 멤버의 이름
     * @param excludeNotifyMemberName 특정 멤버에게는 알리지 않을 경우 (선택)
     */
    public static notifyMemberKicked(partyID: PartyID, kickedMemberName: string, excludeNotifyMemberName?: string): void {
        const payload: PartyMemberLeft = {
            partyId: partyID,
            memberName: kickedMemberName,
        };

        ClientSocketMessageSender.broadcastToParty(
            partyID,
            {
                type: "PartyMemberKicked",
                payload: payload,
            },
            excludeNotifyMemberName
        );
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

        // 멤버 배열의 내용을 콘솔에 출력
        console.log("Party Members to be sent:", partyInfoPayload.members);


        ClientSocketMessageSender.sendToSocket(newMemberWs, {
            type: "PartyInfoNotification",
            payload: partyInfoPayload
        });
    }

    /** 
     * @description 파티 가입 사실 및 가입한 파티 정보를 보냅니다.
     * @param newMemberWs 새로 추가된 멤버의 웹소캣 인스턴스
     * @param partyID 파티 ID
    */
   public static sendPartyJoined(newMemberWs: WebSocket, partyID: PartyID) : void {
    const party = PartyManager.getInstance().getParty(partyID);
        if (!party) {
            console.error(`Party with ID ${partyID} not found.`);
            return;
        }

        const partyJoinedPayload: PartyJoinedPayload = {
            partyId: party.partyId,
            hostName: party.hostName,
            members: party.members
        };

        // 멤버 배열의 내용을 콘솔에 출력
        console.log("Party Members to be sent:", partyJoinedPayload.members);


        ClientSocketMessageSender.sendToSocket(newMemberWs, {
            type: "PartyJoinedByMe",
            payload: partyJoinedPayload
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


     /**
    * @description 파티 해산 알림 (마지막 멤버 탈퇴 등으로 세션 제거될 때)  
    */
    public static notifyPartyDisbanded(partyID: PartyID): void {
        ClientSocketMessageSender.broadcastToParty(partyID, {
            type: "PartyDisbanded",
            payload: { partyId: partyID }
        });
    }

}