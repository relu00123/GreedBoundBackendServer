import { ulid } from "./ulid";

import { MatchId } from "../types/match";
import { TeamId } from "../types/match";
import { TicketId } from "../types/match";
import { DungeonId } from "../types/dungeon";

// --- 생성 함수들
export function genMatchId(): MatchId { return (`m_${ulid()}`) as MatchId; }

export function genTeamId(): TeamId { return (`team_${ulid()}`) as TeamId; }

export function genTicketId(): TicketId { return (`tk_${ulid()}`) as TicketId;}

// 던전 인스턴스 ID (형식 통일)
export function genDungeonId(): DungeonId { return `dng_${ulid()}` as DungeonId; }

// 던전 입장 토큰(유저별, 일회성/단기용 권장)
export function genDungeonAccessToken(): string { return `atk_${ulid()}`; }