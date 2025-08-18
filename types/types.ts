// types.ts
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";

// Token
export type DungeonToken = string;
export type PlayerToken = string;

// Map
export type MapType = "Goblin" | "Ork" | "Ice" | string;

// ClassType
export type CharacterClassType =  "None" | "Knight" | "Archer" | "Mage" | "Cleric" | "Max"| string;
export enum CharacterClassTypeEnum  {
  None  = 0,
  Knight = 1,
  Cleric = 2,
  Archer = 3,
  Mage = 4,
  Max = 5
}

export const CharacterClassNameMap: Record<CharacterClassTypeEnum, CharacterClassType> = {
  [CharacterClassTypeEnum.None]:   "None",
  [CharacterClassTypeEnum.Knight]: "Knight",
  [CharacterClassTypeEnum.Cleric]: "Cleric",
  [CharacterClassTypeEnum.Archer]: "Archer",
  [CharacterClassTypeEnum.Mage]:   "Mage",
  [CharacterClassTypeEnum.Max]:    "Max",
};

// 역매핑: 문자열 → 숫자
export const CharacterClassValueMap: Record<CharacterClassType, CharacterClassTypeEnum> = {
  None : CharacterClassTypeEnum.None,
  Knight: CharacterClassTypeEnum.Knight,
  Cleric: CharacterClassTypeEnum.Cleric,
  Archer: CharacterClassTypeEnum.Archer,
  Mage:   CharacterClassTypeEnum.Mage,
  MAX:    CharacterClassTypeEnum.Max
};

// 헬퍼 함수 예시
export function classEnumToString(value: CharacterClassTypeEnum): CharacterClassType {
  return CharacterClassNameMap[value];
}

export function classStringToEnum(value: CharacterClassType): CharacterClassTypeEnum {
  return CharacterClassValueMap[value];
}



// DungeonSession
export type DungeonSession = {
  mapType : MapType;
  instanceNumber : number;
  players: PlayerToken[];
  ws? : WSWebSocket;
};

// PlayerSession -> 리팩토링을 위해 고민중.. 
export type PlayerSession = {
  username : string;
  ws? : WSWebSocket;

  // 클래스에 관련된 정보
  classType : CharacterClassType;

  // 파티에 관련된 정보 
  party_id? : string;
}

// SocketMessage
export type  SocketMessage = {
  type : string;
  action? : string;
  // string type의 키를 임의로 여러개 가질 수 있고, key는 어떤 타입이든 올 수 있다. 
  [key : string] : any; 
}

 