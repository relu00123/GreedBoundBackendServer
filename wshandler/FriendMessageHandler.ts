import { WebSocket } from "ws";
import { FriendshipManager } from "../services/managers/FriendshipManager";
import { SocketMessage } from "../types/types";
import { PlayerManager } from "../services/managers/PlayerManager";

/**
 * 친구 관련 WebSocket 메시지를 처리하는 핸들러
 */
export async function handleFriendMessage(ws: WebSocket, msg: SocketMessage) {
    const { action, targetId } = msg;

    // 현재 연결된 WebSocket으로부터 사용자 세션을 조회 (인증된 유저인지 확인)
    const senderSession = PlayerManager.getInstance("FriendMessageHandler").getPlayerSessionBySocket(ws);
    if (!senderSession) {
        ws.send(JSON.stringify({ type: "friend", error: "인증되지 않은 사용자입니다." }));
        return;
    }

    const userId = senderSession.username;

    try {
        switch (action) {
            /**
             * 친구 요청 보내기
             * 자기 자신에게는 요청 불가하고, 이미 친구 상태인지도 확인
             * 요청 성공 시, 상대방이 접속 중이면 실시간 알림 전송
             */
            case "add": {
                if (!targetId) {
                    ws.send(JSON.stringify({ type: "friend", error: "targetId가 필요합니다." }));
                    return;
                }

                await FriendshipManager.sendFriendRequest(userId, targetId);

                // 상대방이 현재 접속 중이면 친구 요청 알림 전송
                const targetSession = PlayerManager.getInstance("FriendMessageHandler").getPlayerSessionByUserName(targetId);
                if (targetSession) {
                    targetSession.ws?.send(JSON.stringify({
                        type: "friend",
                        action: "requestReceived", // 클라이언트에서 "친구 요청 받음" UI에 사용
                        from: userId
                    }));
                }

                // 요청 보낸 사용자에게 성공 응답
                ws.send(JSON.stringify({ type: "friend", action: "add", result: "success" }));
                break;
            }

            /**
             * 친구 요청 수락
             * 쌍방 친구 관계를 형성함
             * 상대방이 접속 중이면 친구 수락 알림 전송
             */
            case "accept": {
                if (!targetId) {
                    ws.send(JSON.stringify({ type: "friend", error: "targetId가 필요합니다." }));
                    return;
                }

                await FriendshipManager.acceptFriendRequest(userId, targetId);

                // 수락한 사용자에게 성공 응답
                ws.send(JSON.stringify({ type: "friend", action: "accept", result: "success" }));

                // 요청을 보냈던 상대방이 접속 중이면 수락 알림 전송
                const targetSession = PlayerManager.getInstance("FriendMessageHandler").getPlayerSessionByUserName(targetId);
                if (targetSession) {
                    targetSession.ws?.send(JSON.stringify({
                        type: "friend",
                        action: "accepted", // 클라이언트에서 "친구 수락됨" UI에 사용
                        by: userId
                    }));
                }
                break;
            }

            /**
             * 친구 삭제
             * 양쪽 모두 친구 관계에서 제거됨
             * 상대방이 접속 중이면 삭제 알림 전송
             */
            case "delete": {
                if (!targetId) {
                    ws.send(JSON.stringify({ type: "friend", error: "targetId가 필요합니다." }));
                    return;
                }

                await FriendshipManager.removeFriend(userId, targetId);

                // 삭제한 본인에게 성공 응답
                ws.send(JSON.stringify({ type: "friend", action: "delete", result: "success" }));

                // 상대방이 접속 중이면 친구 삭제 알림 전송
                const targetSession = PlayerManager.getInstance("FriendMessageHandler").getPlayerSessionByUserName(targetId);
                if (targetSession) {
                    targetSession.ws?.send(JSON.stringify({
                        type: "friend",
                        action: "deleted", // 클라이언트에서 "상대방이 나를 삭제함" UI에 사용
                        by: userId
                    }));
                }
                break;
            }

            /**
             * 친구 목록 조회
             */
            case "list": {
                const friendList = await FriendshipManager.getFriendList(userId);
                ws.send(JSON.stringify({
                    type: "friend",
                    action: "list",
                    friends: friendList
                }));
                break;
            }

            /**
             * 대기 중인 친구 요청 목록 조회 (받은 요청들)
             */
            case "pending": {
                const pending = await FriendshipManager.getIncomingRequests(userId);
                ws.send(JSON.stringify({
                    type: "friend",
                    action: "pending",
                    request: pending
                }));
                break;
            }

            /**
             * 알 수 없는 action 값
             */
            default: {
                ws.send(JSON.stringify({
                    type: "friend",
                    error: `알 수 없는 action: ${action}`
                }));
            }
        }
    } catch (err: any) {
        // 모든 예외 상황을 에러로 응답
        ws.send(JSON.stringify({
            type: "friend",
            action,
            error: err.message ?? "알 수 없는 오류"
        }));
    }
}