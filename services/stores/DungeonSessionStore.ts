// services/stores/DungeonSessionStore.ts
import type { DungeonId, DungeonSession, DungeonStatus } from "../../types/dungeon";
import type { MatchId, UserId } from "../../types/match";

export class DungeonSessionStore {
  private static _inst: DungeonSessionStore | null = null;
  static getInstance(): DungeonSessionStore {
    if (!this._inst) this._inst = new DungeonSessionStore();
    return this._inst;
  }

  private constructor() {}

  // ── 인덱스들 ─────────────────────────────────────────────────────────
  /** dungeonId -> session */
  private sessionsByDungeonId = new Map<DungeonId, DungeonSession>();
  /** matchId   -> dungeonId */
  private dungeonIdByMatchId  = new Map<MatchId, DungeonId>();
  /** userId    -> dungeonId (O(1)로 유저가 속한 던전 찾기) */
  private dungeonIdByUserId   = new Map<UserId, DungeonId>();

  // ── 내부 헬퍼(세션-인덱스 동기화) ────────────────────────────────────
  /** 세션 내 모든 유저(토큰/팀) 집합 */
  private buildUserSetForSession(s: DungeonSession): Set<UserId> {
    const set = new Set<UserId>();
    for (const uid of Object.keys(s.tokensByUser)) set.add(uid as UserId);
    for (const uid of Object.keys(s.teamIdByUser)) set.add(uid as UserId);
    return set;
  }

  /** 해당 세션의 유저들을 userId->dungeonId 인덱스에 등록 */
  private addSessionUsersToIndex(s: DungeonSession) {
    for (const uid of this.buildUserSetForSession(s)) {
      this.dungeonIdByUserId.set(uid, s.dungeonId);
    }
  }

  /** 해당 세션의 유저 인덱스 제거 */
  private removeSessionUsersFromIndex(s: DungeonSession) {
    const dId = s.dungeonId;
    for (const [uid, mapped] of this.dungeonIdByUserId) {
      if (mapped === dId) this.dungeonIdByUserId.delete(uid);
    }
  }

  // ── Upsert / 조회 / 상태 변경 ───────────────────────────────────────
  /** 있으면 갱신, 없으면 생성 (upsert) */
  saveSession(session: DungeonSession) {
    const prev = this.sessionsByDungeonId.get(session.dungeonId);
    if (prev) {
      if (prev.matchId !== session.matchId) {
        this.dungeonIdByMatchId.delete(prev.matchId as MatchId);
      }
      // 기존 유저 인덱스 제거 후 새로 반영
      this.removeSessionUsersFromIndex(prev);
    }

    this.sessionsByDungeonId.set(session.dungeonId, session);
    this.dungeonIdByMatchId.set(session.matchId as MatchId, session.dungeonId);
    this.addSessionUsersToIndex(session);
  }

  setSessionPid(dungeonId: DungeonId, pid?: number): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    s.pid = pid;
    return true;
  }

  /** 던전 ID로 세션 조회 */
  getSessionByDungeonId(dungeonId: DungeonId) {
    return this.sessionsByDungeonId.get(dungeonId);
  }

  /** 매치 ID로 세션 조회 */
  getSessionByMatchId(matchId: MatchId) {
    const dId = this.dungeonIdByMatchId.get(matchId);
    return dId ? this.sessionsByDungeonId.get(dId) : undefined;
  }

  /** 유저 ID로 세션 조회(O(1)) */
  getSessionByUserId(userId: UserId) {
    const dId = this.dungeonIdByUserId.get(userId);
    return dId ? this.sessionsByDungeonId.get(dId) : undefined;
  }

  /** 유저 ID로 던전 ID만 조회(O(1)) */
  getDungeonIdByUserId(userId: UserId) {
    return this.dungeonIdByUserId.get(userId);
  }

  /** 세션 상태 변경 */
  setSessionStatus(dungeonId: DungeonId, status: DungeonStatus): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    s.status = status;
    if (status === "ended") {
      s.endedAt = Date.now();
      if (!s.endReason) s.endReason = "completed";
    }
    return true;
  }

  /** 세션 종료(마킹) */
  endSession(dungeonId: DungeonId, reason?: DungeonSession["endReason"]): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    s.status = "ended";
    s.endedAt = Date.now();
    s.endReason = reason ?? s.endReason ?? "completed";
    return true;
  }

  /** 매치 ID로 세션 종료(편의) */
  endSessionByMatchId(matchId: MatchId, reason?: DungeonSession["endReason"]): boolean {
    const dId = this.dungeonIdByMatchId.get(matchId);
    if (!dId) return false;
    return this.endSession(dId, reason);
  }

  /** 세션 제거(모든 인덱스 정리) */
  removeSessionByDungeonId(dungeonId: DungeonId): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;

    this.removeSessionUsersFromIndex(s);
    this.dungeonIdByMatchId.delete(s.matchId as MatchId);
    this.sessionsByDungeonId.delete(dungeonId);
    return true;
  }

  // ── 리스트 API ──────────────────────────────────────────────────────
  listActiveSessions(): DungeonSession[] {
    const out: DungeonSession[] = [];
    for (const s of this.sessionsByDungeonId.values()) {
      if (s.status === "preparing" || s.status === "running") out.push(s);
    }
    return out;
  }

  listSessionsByStatus(status: DungeonStatus): DungeonSession[] {
    const out: DungeonSession[] = [];
    for (const s of this.sessionsByDungeonId.values()) if (s.status === status) out.push(s);
    return out;
  }

  // ── 유저 부착/분리(인덱스 동기화 포함) ─────────────────────────────
  /** 세션에 유저를 부착(토큰/팀ID 선택적). 인덱스 동기화 포함 */
  attachUserToSession(
    dungeonId: DungeonId,
    userId: UserId,
    opts?: { token?: string; teamId?: string }
  ): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    if (opts?.token) s.tokensByUser[userId] = opts.token;
    if (opts?.teamId) s.teamIdByUser[userId] = opts.teamId;
    this.dungeonIdByUserId.set(userId, dungeonId);
    return true;
  }

  /** 세션에서 유저 분리(토큰/팀 모두 제거). 인덱스 동기화 포함 */
  detachUserFromSession(dungeonId: DungeonId, userId: UserId): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    delete s.tokensByUser[userId];
    delete s.teamIdByUser[userId];
    if (this.dungeonIdByUserId.get(userId) === dungeonId) {
      this.dungeonIdByUserId.delete(userId);
    }
    return true;
  }

  /** 외부에서 세션 구조를 직접 만졌다면, 이걸로 인덱스 재빌드 */
  reindexSessionUsers(dungeonId: DungeonId): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    this.removeSessionUsersFromIndex(s);
    this.addSessionUsersToIndex(s);
    return true;
  }

  // ── 토큰 검증/폐기(인덱스도 안전하게) ──────────────────────────────
  /**
   * 유저 토큰 검증(옵션: 소비 후 제거)
   * - return.ok=false 시 reason 포함
   */
  verifyUserToken(
    dungeonId: DungeonId,
    userId: UserId,
    token: string,
    opts?: { consume?: boolean }
  ):
    | { ok: true }
    | { ok: false; reason: "DUNGEON_NOT_FOUND" | "USER_NOT_FOUND" | "TOKEN_MISMATCH" }
  {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return { ok: false, reason: "DUNGEON_NOT_FOUND" };
    const stored = s.tokensByUser[userId];
    if (!stored) return { ok: false, reason: "USER_NOT_FOUND" };
    if (stored !== token) return { ok: false, reason: "TOKEN_MISMATCH" };

    if (opts?.consume) {
      delete s.tokensByUser[userId];
      // 팀 매핑도 없으면 인덱스 제거
      if (!(userId in s.teamIdByUser) && this.dungeonIdByUserId.get(userId) === dungeonId) {
        this.dungeonIdByUserId.delete(userId);
      }
    }
    return { ok: true };
  }

  /** 특정 유저의 토큰 강제 폐기(입장 불가로 만들기) */
  revokeUserToken(dungeonId: DungeonId, userId: UserId): boolean {
    const s = this.sessionsByDungeonId.get(dungeonId);
    if (!s) return false;
    if (!(userId in s.tokensByUser)) return false;
    delete s.tokensByUser[userId];
    // 팀 매핑도 없으면 인덱스 제거
    if (!(userId in s.teamIdByUser) && this.dungeonIdByUserId.get(userId) === dungeonId) {
      this.dungeonIdByUserId.delete(userId);
    }
    return true;
  }
}