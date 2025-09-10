// services/stores/MatchQueueStore.ts
import { 
  TEAM_MAX, TEAMS_PER_MATCH_MAX,
  TeamJoinPolicy, MapId, UserId, TicketId, Match, Team,
  Ticket, SoloTicket, PartyTicket
 } from "../../types/match";

import { isAllowedGameMap } from "../../constants/GameMapCatalog";
import { genMatchId, genTeamId, genTicketId } from "../../utils/id";


// 부분 팀(오픈 전용): 아직 TEAM_MAX를 못 채운 팀
interface PartialTeam {
  teamId: string;               // 임시 팀 식별자
  members: UserId[];            // 현재 이 팀에 들어온 유저들
  sourceTickets: TicketId[];    // 이 팀을 구성한 티켓 ID들 (추적/로그용)
  remaining: number;            // 남은 자리수 : TEAM_MAX - members.length
  createdAt: number;            // FIFO 공정성 (먼저 만든 partial부터 채우기) 판단용
}

// 맵별 현재 상태를 전부 보관 
interface MapState {
  partialTeams: PartialTeam[];                                  // 아직 정원이 안 찬 오픈 팀들 (FIFO 큐 느낌)
  readyTeams: (Team & { createdAt: number })[];                 // 정원이 꽉 찬 팀 (즉시 매치에 얺을 수 있음). 생성 시각을 같이 보관
  currentMatch: { teams: Team[]; createdAt: number } | null;    // 지금 채우는 중인 매치(팀 모아 놓는 바구니). 꽉 차면 발차 
}

export class MatchQueueStore {
  private static _inst: MatchQueueStore | null = null;
  static getInstance() {
    if (!this._inst) this._inst = new MatchQueueStore();
    return this._inst;
  }

  // 맵(던전)별로 독립된 큐/상태를 가진다.
  private maps = new Map<MapId, MapState>();

  // 활성 티켓 보관서 (취소 시 원복/분기 판단에 필요하다)
  private tickets = new Map<TicketId, Ticket>();

  // 발차 콜백(Manager에서 연결)
  private onLaunch?: (m: Match) => void;
  setOnMatchLaunched(cb: (m: Match) => void) { this.onLaunch = cb; }

  // MapState 조회/초기화 
  private state(mapId: MapId): MapState {
    let s = this.maps.get(mapId);
    if (!s) {
      s = { partialTeams: [], readyTeams: [], currentMatch: null };
      this.maps.set(mapId, s);
    }
    return s;
  }

  // 내부: 맵 상태 GC
  private maybeCleanupMap(mapId: MapId) {
    const s = this.maps.get(mapId);
    if (!s) return;
    const emptyCurrent = !s.currentMatch || s.currentMatch.teams.length === 0;
    if (s.partialTeams.length === 0 && s.readyTeams.length === 0 && emptyCurrent) {
      this.maps.delete(mapId);
    }
  }

  // ========== API: Enqueue ==========
  // Closed : 즉시 완성팀으로 반환 후 readyTeams에 push
  // Open : mergeIntoPartial로 보내 부분 팀에 합류(또는 새 partial 생성)
  // 즉시 조립 : tryAssembleMatch 호출로 readyTeams에 팀이 있다면 바로 currentMatch에 흡수해 발차까지 시도. 
  enqueueSolo(mapId: MapId, username: UserId, policy: TeamJoinPolicy): TicketId {
    if (!isAllowedGameMap(mapId)) throw new Error(`Invalid mapId ${mapId}`);

    // 중복 큐잉 방지(같은 맵의 같은 유저 SoloTicket 모두 취소)
    this.cancelAllSoloForUser(mapId, username);

    const t: SoloTicket = { kind: "solo", ticketId: genTicketId(), userId: username, joinPolicy: policy, mapId };
    this.tickets.set(t.ticketId, t);

    if (policy === TeamJoinPolicy.Closed) {
      this.pushReadyTeam(mapId, this.teamFrom([t]));
    } else {
      this.mergeIntoPartial(mapId, [t]);
    }
    this.tryAssembleMatch(mapId);
    return t.ticketId;
  }

  // enqueueSolo와 같지만, 파티 멤버 스냅샷을 가진 PartyTicket을 만든다.
  // Closed이면 바로 readyTeams, Open이면 mergeIntoPartial.
  enqueueParty(mapId: MapId, partyId: number, members: UserId[], policy: TeamJoinPolicy): TicketId {
    if (!isAllowedGameMap(mapId)) throw new Error(`Invalid mapId ${mapId}`);
    if (members.length > TEAM_MAX) throw new Error(`Party size ${members.length} > TEAM_MAX(${TEAM_MAX})`);

      // 중복 큐잉 방지(같은 맵의 같은 파티 PartyTicket 모두 취소)
    this.cancelAllPartyForPartyId(mapId, partyId);

    const t: PartyTicket = { kind: "party", ticketId: genTicketId(), partyId, members: [...members], joinPolicy: policy, mapId };
    this.tickets.set(t.ticketId, t);

    if (policy === TeamJoinPolicy.Closed) {
      this.pushReadyTeam(mapId, this.teamFrom([t]));
    } else {
      this.mergeIntoPartial(mapId, [t]);
    }
    this.tryAssembleMatch(mapId);
    return t.ticketId;
  }

  // ========== 내부: Partial → Ready → Match ==========
  // 오픈 키셈 묶음 (솔로 1명 or 오픈 파티 전원)을 쪼개지 않는 블록으로 취급하여
  // 기존 PartialTeams 중에서 블록 전체를 수용할 수 있는 가장 오래된 팀을 찾아 통째로 합류시키거나
  // 그런 팀이 없다면 새 Partial 생성(또는 block이 정원과 같으면 즉시 ready로 승격)
 private mergeIntoPartial(mapId: MapId, tickets: Ticket[]) {
  const s = this.state(mapId);

  // 1) 들어온 묶음(솔로 1명/오픈 파티 전원) → 블록
  const { members, src } = this.flattenTickets(tickets);
  const blockSize = members.length;

  if (blockSize > TEAM_MAX) {
    throw new Error(`incoming open group size ${blockSize} > TEAM_MAX(${TEAM_MAX})`);
  }

  // 2) 가장 오래된 partial 중 '블록 전체가 들어갈 수 있는' 팀을 찾는다 (FIFO + First-Fit)
  const fitIdx = s.partialTeams.findIndex(p => p.remaining >= blockSize);

  if (fitIdx >= 0) {
    // 2-a) 해당 partial에 블록을 통째로 합류
    const p = s.partialTeams[fitIdx];
    p.members.push(...members);
    p.sourceTickets.push(...src);
    p.remaining = TEAM_MAX - p.members.length;

    // 정원 채워졌으면 ready로 이동
    if (p.remaining === 0) {
      const ready = { teamId: p.teamId, members: [...p.members], sourceTickets: [...p.sourceTickets] };
      s.readyTeams.push({ ...ready, createdAt: p.createdAt });
      s.partialTeams.splice(fitIdx, 1);
    }
    return;
  }

  // 3) 들어갈 팀이 없다면: 블록 크기에 따라 바로 ready 또는 새 partial 생성
  if (blockSize === TEAM_MAX) {
    // 이미 정원 → 즉시 ready
    const team: Team = { teamId: genTeamId(), members: [...members], sourceTickets: [...src] };
    s.readyTeams.push({ ...team, createdAt: Date.now() });
  } else {
    // 정원 미달 → 새 partialTeam 생성(전원 함께)
    const p: PartialTeam = {
      teamId: genTeamId(),
      members: [...members],
      sourceTickets: [...src],
      remaining: TEAM_MAX - blockSize,
      createdAt: Date.now(),
    };
    s.partialTeams.push(p);
  }
}

  // 완성된 팀을 readyTeams에 FIFO로 push
  // 호출 지점 : Closed Ticket의 즉시 팀화, 또는 partial이 방금 정원을 채웠을때 
  private pushReadyTeam(mapId: MapId, team: Team) {
    const s = this.state(mapId);
    s.readyTeams.push({ ...team, createdAt: Date.now() });
  }

  // readyTeams에 팀이 생긴 순간, 현재 채우는 매치(currentMatch)에 가능한 만큼 즉시 채워 넣고,
  // 가득 차면 곧바로 매치 발차 
  private tryAssembleMatch(mapId: MapId): Match[] {
    const s = this.state(mapId);
    const launched: Match[] = [];

    if (!s.currentMatch) {
      s.currentMatch = { teams: [], createdAt: Date.now() };
    }

    // readyTeams(FIFO)에서 currentMatch로 가능한 만큼 흡수
    while (s.currentMatch.teams.length < TEAMS_PER_MATCH_MAX && s.readyTeams.length > 0) {
      const next = s.readyTeams.shift()!;
      s.currentMatch.teams.push({ teamId: next.teamId, members: next.members, sourceTickets: next.sourceTickets });
    }

    // 가득 찼다면 바로 발차
    if (s.currentMatch.teams.length === TEAMS_PER_MATCH_MAX) {
      const match: Match = { matchId: genMatchId(), mapId, teams: s.currentMatch.teams, };
      s.currentMatch = null; // 새 매치를 위한 초기화

       // 발차 후 정리/콜백/GC
      this.cleanupAfterLaunch(mapId, match);
      if (this.onLaunch) this.onLaunch(match);

      launched.push(match);
    }

    return launched;
  }

    // 발차 후 티켓 정리 + 맵 GC
  private cleanupAfterLaunch(mapId: MapId, match: Match) {
    for (const tId of match.teams.flatMap(t => t.sourceTickets)) {
      this.tickets.delete(tId);
    }
    this.maybeCleanupMap(mapId);
  }


  // ========= 취소 API (public) =============
   cancelSolo(mapId: MapId, username: UserId): boolean {
    const ids = [...this.tickets.values()]
      .filter(t => t.kind === "solo" && t.mapId === mapId && t.userId === username)
      .map(t => t.ticketId);
    let ok = false;
    for (const id of ids) ok = this.cancelTicket(mapId, id) || ok;
    this.maybeCleanupMap(mapId);
    return ok;
  }

   /** 파티 큐 취소(해당 파티의 PartyTicket 전체 취소) */
  cancelParty(mapId: MapId, partyId: number): boolean {
    const ids = [...this.tickets.values()]
      .filter(t => t.kind === "party" && t.mapId === mapId && t.partyId === partyId)
      .map(t => t.ticketId);
    let ok = false;
    for (const id of ids) ok = this.cancelTicket(mapId, id) || ok;
    this.maybeCleanupMap(mapId);
    return ok;
  }

  /** 티켓 ID로 직접 취소(가장 범용) */
  cancelTicket(mapId: MapId, ticketId: TicketId): boolean {
    const s = this.state(mapId);
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    // 1) readyTeams → 해당 티켓이 포함된 팀을 찾는다
    const rIdx = s.readyTeams.findIndex(team => team.sourceTickets.includes(ticketId));
    if (rIdx >= 0) {
      this.removeTicketFromReady(mapId, rIdx, ticket);
      this.tickets.delete(ticketId);
      this.tryAssembleMatch(mapId); // 변화가 있으면 즉시 재조립 시도
      this.maybeCleanupMap(mapId);
      return true;
    }

    // 2) partialTeams → 해당 티켓이 포함된 팀을 찾는다
    const pIdx = s.partialTeams.findIndex(p => p.sourceTickets.includes(ticketId));
    if (pIdx >= 0) {
      this.removeTicketFromPartial(mapId, pIdx, ticket);
      this.tickets.delete(ticketId);
      this.maybeCleanupMap(mapId);
      return true;
    }

    // 3) currentMatch에도 들어갔을 수 있음(매치가 아직 발차 전)
    if (s.currentMatch) {
      const teamIdx = s.currentMatch.teams.findIndex(t => t.sourceTickets.includes(ticketId));
      if (teamIdx >= 0) {
        // currentMatch에서 팀을 꺼내서 상태로 되돌린 뒤, 해당 티켓을 제거하고 재배치
        const team = s.currentMatch.teams.splice(teamIdx, 1)[0];

        // team 에서 해당 ticket을 제거
        const remainingSrc = team.sourceTickets.filter(id => id !== ticketId);
        const removeMembers = this.membersFromTicket(ticket);
        const remainingMembers = team.members.filter(m => !removeMembers.includes(m));

        if (remainingMembers.length > 0) {
          // 남은 티켓들의 정책(Open/Closed)에 따라 ready 또는 partial로 회수
          const isOpen = remainingSrc.every(id => (this.tickets.get(id) as Ticket).joinPolicy === TeamJoinPolicy.Open);
          if (isOpen && remainingMembers.length < TEAM_MAX) {
            // partial로 회수
            const p: PartialTeam = {
              teamId: team.teamId,
              members: [...remainingMembers],
              sourceTickets: [...remainingSrc],
              remaining: TEAM_MAX - remainingMembers.length,
              createdAt: Date.now(),
            };
            s.partialTeams.push(p);
          } else {
            // ready로 회수(Closed 팀이거나 정원이 꽉 찬 Open 팀)
            s.readyTeams.push({ teamId: team.teamId, members: remainingMembers, sourceTickets: remainingSrc, createdAt: Date.now() });
          }
        }
        this.tickets.delete(ticketId);
        this.tryAssembleMatch(mapId);
        this.maybeCleanupMap(mapId);
        return true;
      }
    }

    // 어디에도 없으면 실패
    return false;
  }

   // ========== 취소 내부 헬퍼 ==========
  private removeTicketFromPartial(mapId: MapId, partialIdx: number, ticket: Ticket) {
    const s = this.state(mapId);
    const p = s.partialTeams[partialIdx];
    if (!p) return;

    const removeMembers = this.membersFromTicket(ticket);
    p.members = p.members.filter(u => !removeMembers.includes(u));
    p.sourceTickets = p.sourceTickets.filter(id => id !== ticket.ticketId);
    p.remaining = TEAM_MAX - p.members.length;

    // partial 팀이 비면 제거
    if (p.members.length === 0) {
      s.partialTeams.splice(partialIdx, 1);
    }
  }

  private removeTicketFromReady(mapId: MapId, readyIdx: number, ticket: Ticket) {
    const s = this.state(mapId);
    const teamRec = s.readyTeams[readyIdx];
    if (!teamRec) return;

    const removeMembers = this.membersFromTicket(ticket);
    const newMembers = teamRec.members.filter(u => !removeMembers.includes(u));
    const newSrc = teamRec.sourceTickets.filter(id => id !== ticket.ticketId);

    // 팀이 텅 비면 제거
    if (newMembers.length === 0) {
      s.readyTeams.splice(readyIdx, 1);
      return;
    }

    // 남은 티켓들의 정책을 보고 Open/Closed 판단
    const isOpenTeam = newSrc.every(id => (this.tickets.get(id) as Ticket).joinPolicy === TeamJoinPolicy.Open);

    if (isOpenTeam && newMembers.length < TEAM_MAX) {
      // Open 팀이 미달이 됐으니 → partial로 되돌리기
      const p: PartialTeam = {
        teamId: teamRec.teamId,
        members: [...newMembers],
        sourceTickets: [...newSrc],
        remaining: TEAM_MAX - newMembers.length,
        createdAt: teamRec.createdAt, // 기존 대기 시간 유지
      };
      // ready에서 제거 후 partial로 이동
      s.readyTeams.splice(readyIdx, 1);
      s.partialTeams.push(p);
    } else {
      // 그대로 ready에 유지(Closed 팀이거나 정원 유지)
      s.readyTeams[readyIdx] = { ...teamRec, members: newMembers, sourceTickets: newSrc };
    }
  }
  
  private membersFromTicket(ticket: Ticket): UserId[] {
    return ticket.kind === "solo" ? [ticket.userId] : [...ticket.members];
  }

  // ========== 유틸 ==========
  private flattenTickets(tickets: Ticket[]): { members: UserId[]; src: TicketId[] } {
    const members: UserId[] = [];
    const src: TicketId[] = [];
    for (const t of tickets) {
      src.push(t.ticketId);
      if (t.kind === "solo") members.push(t.userId);
      else members.push(...t.members);
    }
    return { members, src };
  }

  private teamFrom(tickets: Ticket[]): Team {
    const { members, src } = this.flattenTickets(tickets);
    return { teamId: genTeamId(), members, sourceTickets: src };
  }

  /** currentMatch가 오래 기다리면 미달이어도 발차 */
  flushIfStale(mapId: MapId, maxWaitMs: number, minTeamsToLaunch = 1): Match[] {
    const s = this.state(mapId);
    if (!s.currentMatch) return [];

    const age = Date.now() - s.currentMatch.createdAt;
    if (age < maxWaitMs) return [];

    if (s.currentMatch.teams.length >= minTeamsToLaunch) {
      const match: Match = { matchId: genMatchId(), mapId, teams: s.currentMatch.teams };
      s.currentMatch = null;

      this.cleanupAfterLaunch(mapId, match);
      if (this.onLaunch) this.onLaunch(match);

      return [match];
    }
    return [];
  }

  /** 디버그/모니터링용 상태 덤프 */
  dump(mapId: MapId) {
    const s = this.maps.get(mapId);
    if (!s) return null;
    return {
      partialTeams: s.partialTeams.map(p => ({
        teamId: p.teamId, size: p.members.length, remaining: p.remaining, createdAt: p.createdAt
      })),
      readyTeams: s.readyTeams.map(t => ({
        teamId: t.teamId, size: t.members.length, createdAt: t.createdAt
      })),
      currentMatch: s.currentMatch ? {
        size: s.currentMatch.teams.length,
        teams: s.currentMatch.teams.map(t => ({ teamId: t.teamId, size: t.members.length })),
        createdAt: s.currentMatch.createdAt
      } : null
    };
  }

   /** 정책 변경(Open↔Closed) 재큐잉(편의) */
  requeueWithPolicy(mapId: MapId, ticketId: TicketId, newPolicy: TeamJoinPolicy): TicketId | null {
    const t = this.tickets.get(ticketId);
    if (!t) return null;
    this.cancelTicket(mapId, ticketId);
    if (t.kind === "solo") {
      return this.enqueueSolo(mapId, t.userId, newPolicy);
    } else {
      return this.enqueueParty(mapId, t.partyId, t.members, newPolicy);
    }
  }

  // 내부: 중복 방지 도우미
  private cancelAllSoloForUser(mapId: MapId, username: UserId): number {
    const ids = [...this.tickets.values()]
      .filter(t => t.kind === "solo" && t.mapId === mapId && t.userId === username)
      .map(t => t.ticketId);
    let count = 0;
    for (const id of ids) if (this.cancelTicket(mapId, id)) count++;
    return count;
  }
  private cancelAllPartyForPartyId(mapId: MapId, partyId: number): number {
    const ids = [...this.tickets.values()]
      .filter(t => t.kind === "party" && t.mapId === mapId && t.partyId === partyId)
      .map(t => t.ticketId);
    let count = 0;
    for (const id of ids) if (this.cancelTicket(mapId, id)) count++;
    return count;
  }


}