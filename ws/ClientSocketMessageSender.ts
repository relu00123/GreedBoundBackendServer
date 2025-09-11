import { WebSocket } from "ws";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";
import { FriendRow, PendingRequestRow, SentRequestRow } from "../services/stores/FriendshipStore";
import { CharacterClassTypeEnum, CharacterClassValueMap } from "../types/character";
import { PlayerSession, PlayerSessionPatch, PlayerSessionUpdated } from "../types/player";
import { BroadcastSocketMessageUtils } from "../utils/BroadcastSocketMessageUtils";
import { PartyID } from "../types/party";
import { PartyManager } from "../services/managers/PartyManager";
import { SocketMessage } from "../types/common";
import { Match, MapId } from "../types/match";

// 필요하다면 type을 다른곳으로 빼기 (09.10 추가)
export type MatchFoundMessage = {
  type: "MatchFound";
  payload: {
    matchId: string;
    mapId: MapId;
    teamId: string;
    teamMembers: string[];
    serverAddr: string;
    token?: string | null;
  };
};


// 아직까지는 JobQueue에 연동해야할 부분이 없지만, 필요하다면 만들어지는 함수를 JobQueue에 연동을 해야한다. 
export class ClientSocketMessageSender {

    // 09.10 추가 
    /** 여러 유저에게 동일 메시지 전송 (편의) */
    public static sendToUsers(usernames: string[], message: any) {
        const data = JSON.stringify(message);
        BroadcastSocketMessageUtils.broadcastToSpecificMembers(usernames, data);
    }

    /** 유저 한 명에게 전송 (토큰 등 사용자별 페이로드가 다를 때 사용) */
    public static sendToUser(username: string, message: any) {
        this.sendToUsers([username], message);
    }

    static sendMatchFoundToUsers(usernames: string[], msg: any) {
        BroadcastSocketMessageUtils.broadcastToSpecificMembers(usernames, JSON.stringify(msg));
    }

    static broadcastMatchAssigned(match: Match) {
        for (const team of match.teams) {
        for (const username of team.members) {
            this.sendToUser(username, {
            type: "MatchAssigned",
            payload: {
                matchId: match.matchId,
                mapId: match.mapId,
                teamId: team.teamId,
                teamMembers: team.members,
            }
            });
        }
        }
    }

    static broadcastDungeonReady(match: Match, serverAddr: string, tokensByUser: Record<string, string>) {
        for (const team of match.teams) {
        for (const username of team.members) {
            this.sendToUser(username, {
            type: "DungeonReady",
            payload: {
                matchId: match.matchId,
                serverAddr,
                token: tokensByUser[username] ?? null
            }
            });
        }
        }
    }

    static broadcastMatchFailed(match: Match, reason: string) {
        for (const team of match.teams) {
        for (const username of team.members) {
            this.sendToUser(username, {
            type: "MatchFailed",
            payload: { matchId: match.matchId, reason }
            });
        }
        }
    }

    /** 매치 발차 알림: 팀원별로 토큰이 다를 수 있으므로 개인별 전송 */
    public static sendMatchFound(match: Match, serverAddr: string, tokensByUser: Record<string, string | undefined>) {
        for (const team of match.teams) {
        for (const username of team.members) {
            const msg: MatchFoundMessage = {
            type: "MatchFound",
            payload: {
                matchId: match.matchId,
                mapId: match.mapId,
                teamId: team.teamId,
                teamMembers: team.members,
                serverAddr,
                token: tokensByUser[username] ?? null,
            },
            };
            this.sendToUser(username, msg);
        }
        }
    }
    // 09.10 추가완 



    /**
     * @description 특정 파티원들에게만 메시지를 전송합니다.
     * @param partyId 메시지를 보낼 파티의 ID
     * @param message 보낼 메시지 객체
     * @param excludeMemberName 브로드캐스트에서 제외할 멤버의 이름 (선택적)
     */
    public static broadcastToParty(partyId: PartyID, message: any, excludeMemberName?: string): void {
        const partySession = PartyManager.getInstance().getParty(partyId);

        if (!partySession) {
            console.warn(`파티 ID ${partyId}를 찾을 수 없습니다. 메시지를 전송하지 않습니다.`);
            return;
        }

        // PartyMember[]를 string[]으로 변환
        const allMembersUsernames = partySession.members.map(member => member.username);
        const data = JSON.stringify(message);

        // 제외할 멤버가 있는 경우
        if (excludeMemberName) {
            const membersToBroadcast = allMembersUsernames.filter(memberName => memberName !== excludeMemberName);
            BroadcastSocketMessageUtils.broadcastToSpecificMembers(membersToBroadcast, data);
        } else {
            // 제외할 멤버가 없는 경우 모든 멤버에게 전송
            BroadcastSocketMessageUtils.broadcastToSpecificMembers(allMembersUsernames, data);
        }
    }

    /**
     * @description 특정 웹소켓 연결을 통해 클라이언트에게 메시지를 전송합니다.
     * @param ws 메시지를 보낼 웹소켓 인스턴스
     * @param message 전송할 메시지 객체 (SocketMessage 타입)
     */
    public static sendToSocket(ws: WebSocket, message: SocketMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                const data = JSON.stringify(message);
                ws.send(data);
            } catch (error) {
                console.error("메시지를 JSON으로 변환하거나 전송하는 중 오류가 발생했습니다:", error);
            }
        } else {
            console.warn("웹소켓 연결이 닫혀있어 메시지를 전송할 수 없습니다.");
        }
    }



    private static buildUserInfoPayload(s : Readonly<PlayerSession>) {
        return {
            username : s.username,
            classType : s.classType,
            classTypeEnum : CharacterClassValueMap[s.classType],
            gamePhase : s.gamePhase,
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

    
    // static sendPlayerJoined(ws : WebSocket, userName : string, classType  : string) {
    //     ws.send(JSON.stringify({
    //         type: "playerJoined",
    //         payload: { userName, classType }
    //     }));
    // }

    static sendPlayerLeft(ws : WebSocket, userName : string) {
        ws.send(JSON.stringify({
            type: "playerLeft",
            payload : {userName}
        }));
    }

    static sendLobbyUserList(ws : WebSocket, sessions : Readonly<PlayerSession>[]) {

        const payload = sessions.map(s=> this.buildUserInfoPayload(s));

        const message = {
            type : "LobbyUserListResponse",
            payload : payload
        };

        ws.send(JSON.stringify(message));
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