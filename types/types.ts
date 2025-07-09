// types.ts

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
};