import WebSocket from "ws";
import { PlayerState } from "../../constants/playerstate"; // enum 스타일로 바꿨을 경우
import {
  getSession,
  updateSessionSafe,
  Session
} from "./sessionStore";

export interface EscapeRequestMessage {
  type : string; 
  payload : {
    dungeonToken : string;
    playerToken : string;
  };
}

function handleEscapeRequest(ws: WebSocket, msg: EscapeRequestMessage) {
  try {
    const { dungeonToken, playerToken} = msg.payload;

    console.log(`[EscapeManager] Trying To Handle Escape Request..`);
    // console.log(`🟢 [EscapeRequest] DungeonToken: ${dungeonToken}`);
    // console.log(`🟢 [EscapeRequest] PlayerToken : ${playerToken}`);

    // 1. DungeonSessionStore에서 해당 DungeonSession에서 플레이어를 빼줘야 함.
    // 아직 DungeonSession에 PlayerList를 채우는 로직이 없어서 이부분은 나중에 해줘야 함.

    // 2. PlayerSession의 ws를 찾아 해당 Player에게 로비로 가라고 해야함. 
    // PlayerSession을 리팩토링 할 것이기 때문에 일단 임시 로직이다. 
    const session = getSession(playerToken) as Session | undefined;

    if (!session || !session.ws) {
      console.warn(`[EscapeResponse] ❌ 유효하지 않은 세션: ${playerToken}`);
      return;
    }
    session.ws.send(JSON.stringify({
      type: "escape_response",
      success: true,
      message: `Player ${session.username} escaped successfully.`
    }));
    
  } catch (err) {
    console.error("❌ [handleEscapeRequest] Error:", err);
  }
}

export {
  handleEscapeRequest
};