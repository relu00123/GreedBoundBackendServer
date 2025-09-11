
import { DungeonId } from "./dungeon";
import { MatchId, TeamId, UserId } from "./match";
import { MapId } from "./match";

export interface JoinDungeonPayload {
  host: string;         // DS의 외부 접속 주소. IP또는 도메인 
  port: number;         // DS의 포트번호 
  dungeonId: DungeonId;    // DS 인스턴스 식별자 
  matchId: MatchId;      // 클라 URL 전달(힌트?), DS는 토큰의 클레임으로 검증?

  teamId: TeamId;       // MQM이 만드는 genTeamID()와 동일 타입/값
  teamSize: number;     // 1~TEAM_MAX. 슬롯 배정 안정화용

  joinToken: string;   // JWT 등 서명 토큰(권위 데이터: teamId/teamSize 포함)
}

export interface MatchFailedPayload {
  matchId: MatchId;
  mapId: MapId;
  reason: string;         // 사람이 읽을 수 있는 이유 메시지
  code?: string | null;   // 선택: 에러 코드(있으면)
}

export interface PlayerJoinCredentials {
  joinToken: string;  // JWT 등 서명 토큰 (teamId/teamSize/matchId/dungeonId 포함)
  teamId: TeamId;     // 문자열 teamId (MatchQueueStore와 동일)
  teamSize: number;   // 1~TEAM_MAX
}

export type JoinCredentialsByUser = Record<UserId, PlayerJoinCredentials>;