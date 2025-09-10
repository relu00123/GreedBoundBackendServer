import { ulid } from "./ulid";

import { MatchId } from "../types/match";
import { TeamId } from "../types/match";
import { TicketId } from "../types/match";

// --- 생성 함수들
export function genMatchId(): MatchId { return (`m_${ulid()}`) as MatchId; }

export function genTeamId(): TeamId { return (`team_${ulid()}`) as TeamId; }

export function genTicketId(): TicketId { return (`tk_${ulid()}`) as TicketId;}