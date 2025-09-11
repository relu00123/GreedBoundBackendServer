import { MapId } from "../types/match";

export type GameMapDef = {
  key: string;           // "GoblinCave" (인간 친화 키)
  displayName: string;   // UI용
  enabled?: boolean;     // 운영 중 임시 오프용(기본 true)
  uePath : string;
};

export const GameMAPS: Record<number, GameMapDef> = {
  1001: { key: "GoblinCave",      displayName: "Goblin Cave",      enabled: true, uePath: "/Game/Maps/Dungeon/GoblinCave/GoblinCave" },
  1002: { key: "ForgottenCastle", displayName: "Forgotten Castle", enabled: true, uePath: "/Game/Maps/Dungeon/ForgottenCastle/ForgottenCastle"},
};

// 파생 인덱스들 (편의)
export type GameMapNumericId = keyof typeof GameMAPS & number;

export const MAP_ALIAS_TO_ID: Record<string, GameMapNumericId> = Object.fromEntries(
  Object.entries(GameMAPS).map(([id, v]) => [v.key, Number(id) as GameMapNumericId])
) as Record<string, GameMapNumericId>;

export function isAllowedGameMap(id: number): id is GameMapNumericId {
  return Object.prototype.hasOwnProperty.call(GameMAPS, id);
}

export function extractGameMapNumericId(body: any): { ok:true; id:number } | { ok:false; error:string } {
  if (typeof body?.GameMapNumericId === "number" && Number.isInteger(body.GameMapNumericId) && body.GameMapNumericId > 0) {
    return { ok:true, id: body.GameMapNumericId };
  }
  if (typeof body?.GameMapId === "string" && body.GameMapId.length > 0) {
    const id = MAP_ALIAS_TO_ID[body.GameMapId];
    if (typeof id === "number") return { ok:true, id };
    return { ok:false, error:`Unknown GameMapId '${body.GameMapId}'` };
  }
  return { ok:false, error:"mapNumericId(number) or GameMapId(string) is required" };
}

export function getUEMapPath(mapId: MapId): string {
  const def = GameMAPS[mapId as GameMapNumericId];
  if (!def) {
    throw new Error(`Unknown mapId ${mapId}. Add it to GameMAPS with a valid uePath.`);
  }
  if (def.enabled === false) {
    throw new Error(`mapId ${mapId} (${def.key}) is disabled.`);
  }
  if (!def.uePath) {
    throw new Error(`mapId ${mapId} (${def.key}) has no uePath.`);
  }
  return def.uePath;
}

 