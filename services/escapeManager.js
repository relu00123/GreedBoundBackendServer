// services/escapeManager.js

const sessionStore = require("./sessionStore");

exports.handleLeaveDungeon = async (ws, msg) => {
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
};