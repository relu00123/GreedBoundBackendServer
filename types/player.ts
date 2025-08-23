import { CharacterClassTypeEnum, CharacterClassType } from "./character";
import { PartyID} from "./party";
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";

export type PlayerSessionUpdated = {
  type: "PlayerSessionUpdated";       // 오타 수정
  userId: string;                     // = username
  //rev: number;                        // 권장(없어도 되지만 강추)
  changed: PlayerSessionPatch;        // 변경된 필드만
};


// 변경될 수 있는 유저 필드 모음
export type PlayerSessionPatch = Partial<{
  username: string;
  classType: CharacterClassTypeEnum;  // Enum 기반 
  partyId: PartyID | null;
  online: boolean;
}>;

export type PlayerSession = {
  username : string;
  ws? : WSWebSocket;

  // 클래스에 관련된 정보
  classType : CharacterClassType;

  // 파티에 관련된 정보 
  party_id? : PartyID;
}