// services/managers/MatchQueueManager.ts
import { MatchQueueStore } from "../stores/MatchQueueStore";
import { TeamJoinPolicy, MapId, Match, UserId, TicketId } from "../../types/match";

// 구현 클래스 직접 사용(자체 주입)
//import { PlayerManager } from "./PlayerManager";
import { PartyManager } from "./PartyManager";
import { DungeonManager } from "./DungeonManager";
import { ClientSocketMessageSender } from "../../ws/ClientSocketMessageSender";

type AgingPolicy = { maxWaitMs: number; minTeamsToLaunch: number };

 
export class MatchQueueManager {
  private static _inst: MatchQueueManager | null = null;
  static getInstance(): MatchQueueManager {
    if (!this._inst) this._inst = new MatchQueueManager();
    return this._inst;
  }

  private store : MatchQueueStore;
  private aging? : AgingPolicy; 

  // 에이징 순회 대상 
  private activeMaps = new Set<MapId>();

  private constructor() {
    this.store =MatchQueueStore.getInstance();
    this.store.setOnMatchLaunched((m) => this.onMatchLaunched(m));
  }

  private async onMatchLaunched(match: Match) {
    const dm = DungeonManager.getInstance();

    // 1) 즉시 "MatchAssigned" 전송 (서버 준비 전)
    ClientSocketMessageSender.broadcastMatchAssigned(match);

    const { dungeonId, serverAddr, tokensByUser } = dm.startMatch(match);
    try {
      await dm.whenReady(dungeonId, 15_000, 100);

      // B단계: 준비 완료 알림(접속 정보 전달)
      ClientSocketMessageSender.broadcastDungeonReady(match, serverAddr, tokensByUser);

      console.log(`[MQM] DungeonReady sent: ${match.matchId} -> ${serverAddr}`);
    } catch (e: any) {
      // 실패/타임아웃
      ClientSocketMessageSender.broadcastMatchFailed(match, String(e?.message || e || "UNKNOWN"));
      dm.endDungeonSession(dungeonId, "aborted");
      console.warn(`[MQM] DS ready failed ${match.matchId}:`, e?.message || e);
    } finally {
      this.refreshActive(match.mapId);
    }

    
  }

  private refreshActive(mapId : MapId) {
    const alive = !!this.store.dump(mapId); //  dump가 null이면 해당 맵 상태가 비어 없어졌다는 뜻 
    if (alive) this.activeMaps.add(mapId);
    else this.activeMaps.delete(mapId);
  }

  // 솔로 큐 진입
  public joinQueueSolo(username : UserId, mapId : MapId, policy : TeamJoinPolicy) {
    const ticketId = this.store.enqueueSolo(mapId, username, policy);
    this.refreshActive(mapId);

    // 솔로큐에 입장한 인원에게 큐에 입장했음을 알려야함. 
    ClientSocketMessageSender.sendToUser(username,  {type : "QueueJoined", payload: {mapId, policy, ticketId}});
    return {ticketId};
  }

  // 파티 큐 진입
  public joinQueueParty(partyId: number, mapId: MapId, policy: TeamJoinPolicy, requestedBy?: UserId) 
  { 
    if (requestedBy && !PartyManager.getInstance().isHost(partyId, requestedBy)) {
     throw new Error("ONLY_HOST_CAN_QUEUE");
    }
  
    const members = PartyManager.getInstance().getPartyMemberUsernames(partyId); // ✅ 서버에서 조회
    const ticketId = this.store.enqueueParty(mapId, partyId, members, policy);
    this.refreshActive(mapId);

    // 파티큐로 입장한 파티원들에게 큐에 입장했음을 알려야함. 
    ClientSocketMessageSender.sendToUsers(members, { type: "QueueJoined", payload: { mapId, policy, ticketId, partyId } });

    return { ticketId, members };
  }

  // 솔로 큐 취소
  public cancelSolo(mapId : MapId, username : UserId) {
    const ok = this.store.cancelSolo(mapId, username);
    this.refreshActive(mapId);

    if (ok) {
      // 본인에게 취소 알림
      ClientSocketMessageSender.sendToUser(username, { type : "QueueCanceled", payload : {mapId, scope : "solo"}});
    }

    return {ok};
  }

  // 파티 큐 취소(파티 전원)
  public cancelParty(mapId : MapId , partyId: number) {
    let members : UserId[] = [];
    try {
      members = PartyManager.getInstance().getPartyMemberUsernames(partyId);
    } catch {
      // 파티가 이미 없을 수 있음 -> 알림 없이 넘어가도 무방하다. 
      // 매칭큐에 등록된 상태에서는 Party해제 못하도록 예외처리해야한다. 클라이언트만 해주면됨. 
    }

    const ok = this.store.cancelParty(mapId, partyId);
    this.refreshActive(mapId);

    if (ok && members.length > 0) {
      // 파티 전원에게 취소 알림
      ClientSocketMessageSender.sendToUsers(members, { type : "QueueCanceled", payload : {mapId, scope: "party", partyId}});
    }

    return {ok};
  }

  // 모든 활성 맵에서 해당 유저의 솔로 티켓 취소
  public cancelSoloAcrossMaps(username : UserId) {
    let ok = false;
    for (const mapId of [...this.activeMaps]) {
      ok = this.store.cancelSolo(mapId, username) || ok;
      this.refreshActive(mapId);
    }

    return {ok};
  }

  /** 모든 활성 맵에서 해당 파티의 파티 티켓 취소 */
  public cancelPartyAcrossMaps(partyId: number) {
    let ok = false;
    const affectedMaps: MapId[] = [];
    for (const mapId of [...this.activeMaps]) {
      const res = this.store.cancelParty(mapId, partyId);
      if (res) { ok = true; affectedMaps.push(mapId); }
      this.refreshActive(mapId);
    }
    return { ok, affectedMaps };
  }

   public cancelTicket(mapId: MapId, ticketId: TicketId) {
    const ok = this.store.cancelTicket(mapId, ticketId);
    this.refreshActive(mapId);
    return { ok };
  }

  public requeueWithPolicy(mapId: MapId, ticketId: TicketId, newPolicy: TeamJoinPolicy) {
    const newId = this.store.requeueWithPolicy(mapId, ticketId, newPolicy);
    this.refreshActive(mapId);
    return { ticketId: newId };
  }

  // Aging 정책 설정 (없으면 미사용)
  public configureAging(policy?: AgingPolicy) {
    this.aging = policy;
    return this; // chaining 용도 
  }

  // 주기적으로 호출 : 오래 대기한 currentMatch를 미달이여도 발차
  public tickAging(): Match[] {

  // 에이징 정책이 설정하지 않아있으면 아무것도 하지 않고 종료 
  if (!this.aging) return [];

  // 이번 틱에서 에이징으로 발차된 매치들을 모아서 반환하려고 만든 배열 
  // 실제 발차 처리는 MatchQueueStore.FlushIfStale 내부에서 한다. 
  const launched: Match[] = [];
  // 복사본 순회(안전)

  // 지금 큐/ 매치가 살아있는 맵들의 집합 
  for (const mapId of [...this.activeMaps]) {
    launched.push(
      ...this.store.flushIfStale(
        mapId,
        this.aging.maxWaitMs,
        this.aging.minTeamsToLaunch
      )
    );
    this.refreshActive(mapId); // 에이징 결과 반영(비었으면 제거)
  }
  return launched;
  }

  public dumpMap(mapId: MapId) {
    return this.store.dump(mapId);
  }

  
}
