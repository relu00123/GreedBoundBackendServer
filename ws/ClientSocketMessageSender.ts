import { WebSocket } from "ws";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";
import { FriendRow, PendingRequestRow, SentRequestRow } from "../services/stores/FriendshipStore";
import { CharacterClassTypeEnum, CharacterClassValueMap, PlayerSession, PlayerSessionPatch, PlayerSessionUpdated } from "../types/types";
import { BroadcastSocketMessageUtils } from "../utils/BroadcastSocketMessageUtils";

// 아직까지는 JobQueue에 연동해야할 부분이 없지만, 필요하다면 만들어지는 함수를 JobQueue에 연동을 해야한다. 
export class ClientSocketMessageSender {

    private static buildUserInfoPayload(s : Readonly<PlayerSession>) {
        return {
            username : s.username,
            classType : s.classType,
            classTypeEnum : CharacterClassValueMap[s.classType],
        } as const;
    }

    static broadcastuserInfoUpdatedToAll(snapshot : Readonly<PlayerSession>) {
        const payload = this.buildUserInfoPayload(snapshot);
        BroadcastSocketMessageUtils.broadcastToAllLobbyMember({
            type : "UserInfoUpdated",
            payload,
        });
    }

     static broadcastPlayerSessionUpdatedToAll(snapshot: Readonly<PlayerSession>, changed: PlayerSessionPatch): void  {
        // 빈 패치는 전송할 필요 없음
        if (!changed || Object.keys(changed).length === 0) return;

        const userId = snapshot.username;

        const msg: PlayerSessionUpdated = {
        type: "PlayerSessionUpdated",
        userId,
        changed,
        };

        // 전 로비(or 전체 접속자)에게 브로드캐스트
        // 로비 스코프로 제한하고 싶으면 broadcastToLobbyMember(snapshot.lobbyId, msg) 같은 걸로 교체
        BroadcastSocketMessageUtils.broadcastToAllLobbyMember(msg);
    }


    static sendPlayerJoined(ws : WebSocket, userName : string, classType  : string) {
        ws.send(JSON.stringify({
            type: "playerJoined",
            payload: { userName, classType }
        }));
    }

    static sendPlayerLeft(ws : WebSocket, userName : string) {
        ws.send(JSON.stringify({
            type: "playerLeft",
            payload : {userName}
        }));
    }

    static sendFriendListResponse(ws : WebSocket, friendList : FriendRow[]) {
        ws.send(JSON.stringify({
            type: "FriendListResponse",
            payload: friendList
        }));
    }

    static sendFriendRequestSentListResponse(ws : WebSocket, sentList: SentRequestRow[]) {
        ws.send(JSON.stringify({
            type: "FriendRequestSentListResponse",
            payload: sentList
        }));
    }

    // 런타임에 친구추가를 보낸 사람은 Server로 부터 제대로 친구추가가 되었는지 응답을 받아야 한다.
    // 제대로 친구추가가 되었으면 보낸 친구목록에 추가를 해줘야 한다. 
    static sendAddFriendRequestSentResponse(ws : WebSocket, isSucceed : boolean,  sentPacket? : SentRequestRow )
    {
        ws.send(JSON.stringify({
            type : "AddFriendRequestSentResponse",
            payload : {sentPacket, isSucceed}
        }));
    }

    static AcceptFriendRequest(ws : WebSocket, SenderID : string, ReceiverID : string) {
        const payload = {
            AcceptedBy : SenderID,
            AcceptedTo : ReceiverID,
            status  : 'accepted'
        };

        if (ws) 
        {
            ws.send(JSON.stringify({
                type : "FriendRequestAccepted",
                payload
            }));
        }
    }

    static RejectFriendRequest(ws : WebSocket, SenderID : string, ReceiverID : string) {
        if (ws) 
        {
            ws.send(JSON.stringify({
                type : "FriendRequestRejected",
                payload : {
                    rejectedBy : SenderID,
                    rejectedTo : ReceiverID
                }
            }));
        }
    }

    static sendRemoveFriend(ws : WebSocket, TargetID : string) {
        if (ws)
        {
            ws.send(JSON.stringify({
                type : "FriendRemoved",
                payload : {
                    targetID : TargetID
                }
            }))
        }
    }

    // 런타임에 친구추가를 받은 사람은 Server로 부터 누가 친구요청을 받았는지 알아야 한다.
    // 친구추가 Popup을 띄우고, 받은 친구목록에 유저를 더해줘야 한다. 
    static sendFriendRequestReceived(ws : WebSocket, receivedPacket : PendingRequestRow)
    {
        ws.send(JSON.stringify({
            type : "FriendRequestReceived",
            payload : receivedPacket
        }));
    }

    static sendFriendRequestReceivedListResponse(ws : WebSocket, receivedList : PendingRequestRow[])  {
        ws.send(JSON.stringify({
            type: "FriendRequestReceivedListResponse",
            payload : receivedList
        }));
    }

    static sendDeleteSentFriendRequest(ws : WebSocket, userID : string) {
        ws.send(JSON.stringify({
            type : "DeleteSentFriendRequest",
            payload : userID
        }));
    }

    static sendDeleteReceivedFriendRequest(ws : WebSocket, userID : string) {
        ws.send(JSON.stringify({
            type : "DeleteReceivedFriendRequest",
            payload : userID
        }));
    }
}