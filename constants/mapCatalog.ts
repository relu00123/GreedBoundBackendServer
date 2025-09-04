export type MapDef = {
  key: string;           // "GoblinCave" (인간 친화 키)
  displayName: string;   // UI용
  enabled?: boolean;     // 운영 중 임시 오프용(기본 true)
};

export const MAPS = {
  1001: { key: "GoblinCave",      displayName: "Goblin Cave",      enabled: true },
  1002: { key: "ForgottenCastle", displayName: "Forgotten Castle", enabled: true },
} as const satisfies Record<number, MapDef>;

// 파생 인덱스들 (편의)
export type MapNumericId = keyof typeof MAPS & number;

export const MAP_ALIAS_TO_ID: Record<string, MapNumericId> = Object.fromEntries(
  Object.entries(MAPS).map(([id, v]) => [v.key, Number(id) as MapNumericId])
) as Record<string, MapNumericId>;

export function isAllowedMap(id: number): id is MapNumericId {
  return Object.prototype.hasOwnProperty.call(MAPS, id);
}