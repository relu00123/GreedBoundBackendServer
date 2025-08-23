import { WebSocketServer, WebSocket as WSWebSocket } from "ws";
import { PlayerToken } from "./common";

// Map
export type MapType = "Goblin" | "Ork" | "Ice" | string;

// DungeonSession
export type DungeonSession = {
  mapType : MapType;
  instanceNumber : number;
  players: PlayerToken[];
  ws? : WSWebSocket;
};