import type { UserId, MapId, Team } from "./match";

export type DungeonId = string;
export type DungeonStatus = "preparing" | "running" | "ended";

// DungeonSession
export interface DungeonSession {
  dungeonId: DungeonId;                       // 실행 인스턴스 
  matchId: string;                            // 매치 ID와 연결
  mapId: MapId;                               // 어떤 맵에서 돌아가는가?
  teams: Team[];
  createdAt: number;
  status: DungeonStatus;

  serverAddr: string;                          // "host:port"
  serverHost: string;                          // 예: "127.0.0.1"
  serverPort: number;                          // 예: 7777
  pid?: number;                                // 관측/디버그용 

  tokensByUser: Record<UserId, string>;       // 유저별 입장 토큰 (소비 시 삭제 권장)
  teamIdByUser: Record<UserId, string>;       // 유저→팀 매핑(검증 편의)

  // 종료/운영 정보(선택)
  endedAt?: number;
  endReason?: "completed" | "aborted" | "timeout" | "crash";
}

// 매칭 발차 시 MQM에 반환할 최소 결과
export interface DungeonStartResult {
  dungeonId: DungeonId;
  serverAddr: string;
  tokensByUser: Record<UserId, string>;
}