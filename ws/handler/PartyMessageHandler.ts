import { Socket } from "dgram";
import { PlayerManager } from "../../services/managers/PlayerManager";
import { SocketMessage } from "../../types/common";
import { ClientSocketMessageSender } from "../ClientSocketMessageSender";
import { WebSocket } from 'ws';
import { PartyID } from "../../types/party";
import { PartyManager } from "../../services/managers/PartyManager";
import { PartyNotificationService } from "../services/PartyNotificationService";



/**
 * PartyMessageHandler 클래스는 파티 관련 웹소켓 메시지를 처리합니다.
 * 이 클래스는 ClientSocketMessageHandler에 의해 호출되며, 실제 비즈니스 로직을 PartyManager에 위임합니다.
 */
export class PartyMessageHandler {

    /**
     * @description 파티 초대 요청을 처리합니다.
     * @param ws 클라이언트 웹소켓 인스턴스 (초대를 보낸 사람)
     * @param msg 수신된 메시지 객체
     */
    public static handleSendPartyInviteRequest(ws: WebSocket, msg: SocketMessage): void {
        console.log("SendPartyInviteRequest Received in PartyMessageHandler");

        const inviterPlayer = PlayerManager.getInstance("PartyMessageHandler").getPlayerSessionBySocket(ws);
        const inviteeName = msg.payload.inviteeName; // 초대받은 사람의 이름

        if (!inviterPlayer) {
            PartyNotificationService.sendPartyInviteResponse(ws, { success: false, error: "NOT_AUTHENTICATED" });
            return;
        }

        const inviteePlayer = PlayerManager.getInstance("PartyMessageHandler").getPlayerSessionByUserName(inviteeName);

        if (!inviteePlayer) {
            PartyNotificationService.sendPartyInviteResponse(ws, { success: false, error: "INVITEE_NOT_FOUND" });
            return;
        }

        // 초대받은 클라이언트에게 파티 초대 알림을 보냅니다.
        if (inviteePlayer.ws) {
            PartyNotificationService.sendPartyInviteNotification(inviteePlayer.ws, inviterPlayer.username);
        }

        // 초대를 보낸 클라이언트에게 성공 응답을 보냅니다.
        PartyNotificationService.sendPartyInviteResponse(ws, { success: true, inviteeName });
    }

    /**
     * @description 파티 초대 수락 요청을 처리하고 파티를 생성하거나 기존 파티에 멤버를 추가합니다.
     * @param ws 클라이언트 웹소켓 인스턴스 (초대를 수락한 사람)
     * @param msg 수신된 메시지 객체
     */
    public static handleAcceptPartyInviteRequest(ws: WebSocket, msg: SocketMessage): void {
        console.log("AcceptPartyInviteRequest Received in PartyMessageHandler");

        const inviteePlayer = PlayerManager.getInstance("PartyMessageHandler").getPlayerSessionBySocket(ws);
        const inviterName = msg.payload.inviterName; // 초대한 사람의 이름

        if (!inviteePlayer) {
            PartyNotificationService.sendAcceptPartyInviteResponse(ws, { success: false, error: "NOT_AUTHENTICATED" });
            return;
        }

        const inviterPlayer = PlayerManager.getInstance("PartyMessageHandler").getPlayerSessionByUserName(inviterName);

        if (!inviterPlayer) {
            PartyNotificationService.sendAcceptPartyInviteResponse(ws, { success: false, error: "INVITER_NOT_FOUND" });
            return;
        }

        // inviter가 이미 파티에 있는지 확인합니다.
        const existingPartyId = inviterPlayer.party_id;
        let newPartyID: PartyID;

        if (existingPartyId) {
            const existingParty = PartyManager.getInstance().getParty(existingPartyId);

            if (!existingParty) {
                // inviter가 파티 ID를 가지고 있지만, 실제 파티가 존재하지 않는 경우
                console.log("Party Does not Exists [PartyMessageHandler.handleAcceptPartyInviteRequest]");
                PartyNotificationService.sendAcceptPartyInviteResponse(ws, { success: false, error: "PARTY_NOT_FOUND" });
                return;
            }

            // 기존 파티에 멤버를 추가합니다.
            const isAdded = PartyManager.getInstance().addMember(existingPartyId, inviteePlayer.username);

            if (!isAdded) {
                PartyNotificationService.sendAcceptPartyInviteResponse(ws, { success: false, error: "PARTY_IS_FULL" });
                return;
            }

            newPartyID = existingPartyId;
            PlayerManager.getInstance("partyMesageHandler").updatePlayerSession(inviteePlayer.username, { party_id: newPartyID });

            // 기존 파티원들에게는 파티에 새로운 멤버가 추가되었음을 알립니다.
            PartyNotificationService.notifyMemberJoined(newPartyID, inviteePlayer.username, inviteePlayer.username);

            // 새로 파티에 들어온 멤버에게는 파티 정보를 보냅니다. 
            PartyNotificationService.sendPartyInfo(ws, newPartyID);

            // 초대 수락 응답을 초대 수락한 클라이언트에게 보냅니다. (굳이?)
            //PartyNotificationService.sendAcceptPartyInviteResponse(ws, { success: true, partyId: newPartyID, hostName: inviterPlayer.username });

            return;

        } else {
            // inviter가 파티에 속해 있지 않으므로, 새로운 파티를 만듭니다.
            newPartyID = PartyManager.getInstance().createParty(inviterPlayer.username);

            // inviterPlayer와 inviteePlayer 모두를 파티에 추가합니다.
            const isInviterAdded = PartyManager.getInstance().addMember(newPartyID, inviterPlayer.username);
            const isInviteeAdded = PartyManager.getInstance().addMember(newPartyID, inviteePlayer.username);

            if (!isInviterAdded || !isInviteeAdded) {
                // 파티 생성에 실패한 경우
                PartyNotificationService.sendAcceptPartyInviteResponse(ws, { success: false, error: "PARTY_CREATION_FAILED" });
                return;
            }

            // 파티장과 파티원의 세션 정보를 업데이트합니다.
            PlayerManager.getInstance("PartyMessageHandler").updatePlayerSession(inviterPlayer.username, { party_id: newPartyID });
            PlayerManager.getInstance("PartyMessageHandler").updatePlayerSession(inviteePlayer.username, { party_id: newPartyID });

            // 새로 생성된 파티 정보를 모든 파티원에게 보냅니다.
            // invitee
            PartyNotificationService.sendPartyInfo(ws, newPartyID);
            // inviter
            const invitersession = PlayerManager.getInstance("PartyMessageHandler").getPlayerSessionByUserName(inviterPlayer.username);
            if (invitersession?.ws)
            {
                PartyNotificationService.sendPartyInfo(invitersession.ws, newPartyID);
            }

            // 초대를 보낸 클라이언트에게도 파티가 생성되었음을 알립니다. (굳이.. 필요없을 것 같은데)
            // if (inviterPlayer.ws) {
            //     PartyNotificationService.notifyPartyCreated(inviterPlayer.ws, { partyId: newPartyID, hostName: inviterPlayer.username });
            // }
        }
    }
}
