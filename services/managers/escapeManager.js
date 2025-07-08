// services/escapeManager.js

const playerstate = require("../../constants/playerstate");
const sessionStore = require("./sessionStore");

// 플레이어 탈출 요청 처리 (기존)
function handleLeaveDungeon(ws, msg) {
  try {
    const {
      playerId,
      token,
      dungeonId,
      status,     // 'escaped' 또는 'dead'
      timestamp   // ms 기준 Unix timestamp
    } = msg;

    const session = sessionStore.getSession(token);

    // 1. 세션 유효성 검사
    if (!session || session.isDedicated !== true) {
      console.warn(`❌ [탈출 거부] 유효하지 않은 Dedicated 세션: token=${token}`);
      return ws.send(JSON.stringify({
        type: "leave_dungeon_response",
        success: false,
        message: "Invalid or unauthorized session"
      }));
    }

    // 2. 필드 유효성 검사
    if (!playerId || !dungeonId || !status) {
      console.warn(`❌ [탈출 거부] 필드 누락`);
      return ws.send(JSON.stringify({
        type: "leave_dungeon_response",
        success: false,
        message: "Missing required fields"
      }));
    }

    // 3. (선택) DB 반영 (지금은 생략 가능)

    // 4. 성공 응답 전송
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

// Escape 요청 처리 (새로 추가)
function handleEscapeRequest(ws, msg) {
  try {
    const {
      characterId,
      token,
      dungeonId,
      status,     // 'escaped' 또는 'dead'
      timestamp   // Unix ms
    } = msg;

    const session = sessionStore.getSession(token);

    if (!session || session.isDedicated !== true) {
      console.warn(`❌ [탈출 거부] 유효하지 않은 세션: token=${token}`);
      return ws.send(JSON.stringify({
        type: "escape_response",
        success: false,
        message: "Invalid session"
      }));
    }

    if (!characterId || !dungeonId || !status) {
      console.warn(`❌ [탈출 거부] 필드 누락`);
      return ws.send(JSON.stringify({
        type: "escape_response",
        success: false,
        message: "Missing required fields"
      }));
    }

    // 플레이어의 상태 업데이트
    sessionStore.updateSessionSafe(token, {
      state : playerstate.IDLE
    });

    // 업데이트된 플레이어의 상태 출력 
    const updatedSession = sessionStore.getSession(token);
    console.log(updatedSession);

    // 성공 응답
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

// 외부에 함수 export
module.exports = {
  handleLeaveDungeon,
  handleEscapeRequest
};