// src/domain/ClientGamePhase.ts

// UE UENUM과 1:1 — 대소문자/스펠링까지 동일하게!
export const ClientGamePhases = [
  "None",
  "GameInitializing",
  "Lobby",
  "InMatchingQueue",
  "InDungeon",
  "GameFinished",
  "Pending",
] as const;

export type ClientGamePhase = typeof ClientGamePhases[number];

// 빠른 검사용 Set (정확 일치만 허용)
const PHASE_SET = new Set<string>(ClientGamePhases as readonly string[]);

/** 문자열이 정확히(대소문자 포함) 유효한 페이즈인지 */
export function isClientGamePhase(v: unknown): v is ClientGamePhase {
  return typeof v === "string" && PHASE_SET.has(v);
}

/** 안전 파서: 틀리면 null 반환 */
export function parseClientGamePhase(v: unknown): ClientGamePhase | null {
  return isClientGamePhase(v) ? v : null;
}

 