// types.ts
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";

// Token
export type DungeonToken = string;
export type PlayerToken = string;

// Map
export type MapType = "Goblin" | "Ork" | "Ice" | string;

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

 