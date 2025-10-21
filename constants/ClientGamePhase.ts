// src/domain/ClientGamePhase.ts

// UE UENUM과 1:1 — 대소문자/스펠링까지 동일하게!
// export const ClientGamePhases = [
//   "None",
//   "GameInitializing",
//   "Lobby",
//   "InMatchingQueue",
//   "MatchAssigned",
//   "JoiningDungeon",
//   "InDungeon",
//   "GameFinished",
//   "Pending",
// ] as const;

//export type ClientGamePhase = typeof ClientGamePhases[number];


export enum ClientGamePhase {
  None = "None",
  GameInitializing = "GameInitializing",
  Lobby = "Lobby",
  InMatchingQueue = "InMatchingQueue",
  // Match가 Assigned 되었지만 DS가 준비가 안된 상황, 클라에서는 버튼만 MatchAssigned로 변경
  // 클라에서는 이때 맵로딩하면 안됨, DS생성중 실패되면 다시 로비로 보내야 하기 때문에. Client UI는 버튼만 MatchAssigned로 변경한다. 
  MatchAssigned = "MatchAssigned",   
  // DS는 준비가 된 상태, 클라들은 Map로딩 및 다른 클라이언트들이 준비완료되기까지를 기다려야 하는 상황 
  // 클라에서는 게임 일러스트와 간단한 팁이 띄워지도록 할 것임.  
  JoiningDungeon = "JoiningDungeon",  
  InDungeon = "InDungeon",
  GameFinished = "GameFinished",
  Pending = "Pending",
}
 

// enum의 값들만 추출
const ALL_PHASE_VALUES = Object.values(ClientGamePhase);

const PHASE_SET = new Set<ClientGamePhase>(ALL_PHASE_VALUES);

/** 문자열이 정확히(대소문자 포함) 유효한 Phase인지 검사 */
export function isClientGamePhase(v: unknown): v is ClientGamePhase {
  return typeof v === "string" && PHASE_SET.has(v as ClientGamePhase);
}

/** 안전 파서: 잘못된 입력이면 null 반환 */
export function parseClientGamePhase(v: unknown): ClientGamePhase | null {
  return isClientGamePhase(v) ? v : null;
}

 