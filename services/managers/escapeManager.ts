import WebSocket from "ws";
import { PlayerState } from "../../constants/playerstate"; // enum 스타일로 바꿨을 경우
import {
  getSession,
  updateSessionSafe,
  Session
} from "./sessionStore";

export interface LeaveDungeonMessage {
  playerId: string;
  token: string;
  dungeonId: string;
  status: string; // "escaped" | "dead"
  timestamp: number;
}

export interface EscapeRequestMessage {
  characterId: string;
  token: string;
  dungeonId: string;
  status: string; // "escaped" | "dead"
  timestamp: number;
}

// 플레이어 탈출 요청 처리 (기존)
function handleLeaveDungeon(ws: WebSocket, msg: LeaveDungeonMessage) {
  try {
    const { playerId, token, dungeonId, status } = msg;

    const session = getSession(token) as Session | undefined;

    if (!session || session.isDedicated !== true) {
      console.warn(`❌ [탈출 거부] 유효하지 않은 Dedicated 세션: token=${token}`);
      ws.send(JSON.stringify({
        type: "leave_dungeon_response",
        success: false,
        message: "Invalid or unauthorized session"
      }));
      return;
    }

    if (!playerId || !dungeonId || !status) {
      console.warn(`❌ [탈출 거부] 필드 누락`);
      ws.send(JSON.stringify({
        type: "leave_dungeon_response",
        success: false,
        message: "Missing required fields"
      }));
      return;
    }

    // 성공 응답
    ws.send(JSON.stringify({
      type: "leave_dungeon_response",
      success: true,
      message: `Player ${playerId} reported as ${status}`
    }));

    console.log(`✅ [탈출 처리 완료] PlayerID: ${playerId}, Status: ${status}, DungeonID: ${dungeonId}`);
  } catch (err) {
    console.error("❌ [handleLeaveDungeon] 오류:", err);
    ws.send(JSON.stringify({
      type: "leave_dungeon_response",
      success: false,
      message: "Internal server error"
    }));
  }
}

// Escape 요청 처리 (신규)
function handleEscapeRequest(ws: WebSocket, msg: EscapeRequestMessage) {
  try {
    const { characterId, token, dungeonId, status } = msg;

    const session = getSession(token) as Session | undefined;

    if (!session || session.isDedicated !== true) {
      console.warn(`❌ [탈출 거부] 유효하지 않은 세션: token=${token}`);
      ws.send(JSON.stringify({
        type: "escape_response",
        success: false,
        message: "Invalid session"
      }));
      return;
    }

    if (!characterId || !dungeonId || !status) {
      console.warn(`❌ [탈출 거부] 필드 누락`);
      ws.send(JSON.stringify({
        type: "escape_response",
        success: false,
        message: "Missing required fields"
      }));
      return;
    }

    // 상태 업데이트
    updateSessionSafe(token, {
      state: PlayerState.IDLE,
    });

    const updatedSession = getSession(token);
    console.log(updatedSession);

    ws.send(JSON.stringify({
      type: "escape_response",
      success: true,
      message: `Escape success for character ${characterId} (${status})`
    }));

    console.log(`✅ [Escape 처리 완료] CharacterID: ${characterId}, Status: ${status}, DungeonID: ${dungeonId}`);
  } catch (err) {
    console.error("❌ [handleEscapeRequest] 오류:", err);
    ws.send(JSON.stringify({
      type: "escape_response",
      success: false,
      message: "Internal server error"
    }));
  }
}

export {
  handleLeaveDungeon,
  handleEscapeRequest
};