import { GameMapNumericId } from "../constants/GameMapCatalog";
import { PartyID } from "./party";

declare const __MatchIdBrand: unique symbol;
declare const __TeamIdBrand: unique symbol;
declare const __TicketIdBrand: unique symbol;

export type MatchId  = string & { readonly [__MatchIdBrand]: void };
export type TeamId   = string & { readonly [__TeamIdBrand]: void };
export type TicketId = string & { readonly [__TicketIdBrand]: void };

export const TEAM_MAX = 3 as const;                 // 최대 팀에 들어올 수 있는 인원수
export const TEAMS_PER_MATCH_MAX = 2 as const;      // 한 던전에 들어올 수 있는 팀의 수

export enum TeamJoinPolicy {
    Open = "Open",     // 다른 사람 합류 허용
    Closed = "Closed", // 단독 입장만 
}

export type TicketKind = "solo" | "party";

// 플레이어 식별자 : PlayerSession.username과 동일 
export type UserId = string;
export type MapId  = GameMapNumericId;      // 카탈로그 숫자 ID

export interface TicketBase {
    ticketId: TicketId;
    mapId : MapId;
}

export interface SoloTicket extends TicketBase {
    kind : "solo"; // 이걸 이렇게 관리하는 것이 좋은가? enum을 쓰지 않고?
    userId : UserId;
    joinPolicy : TeamJoinPolicy; // open이면 파티/ 개인과 합쳐서 팀 구성 가능
}

export interface PartyTicket extends TicketBase {
    kind : "party"; 
    partyId : PartyID;
    members : UserId[]; // 파티 구성원
    joinPolicy : TeamJoinPolicy; // open이면 부족 인원 충원 가능
}

export type Ticket = SoloTicket | PartyTicket;

export interface Team {
    teamId: string;
    members: UserId[]; // 최종 팀 멤버
    sourceTickets: TicketId[]; // 어떤 티켓들이 합쳐졌는지 추적 
}

export interface Match {
    matchId : MatchId;   
    mapId : MapId;
    teams : Team[]; // 최대 TEAMS_PER_MATCH_MAX 개 
}
