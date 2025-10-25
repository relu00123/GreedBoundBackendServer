// services/managers/MatchQueueManager.ts
import { MatchQueueStore } from "../stores/MatchQueueStore";
import { TeamJoinPolicy, MapId, Match, UserId, TicketId } from "../../types/match";

// 구현 클래스 직접 사용(자체 주입)
//import { PlayerManager } from "./PlayerManager";
import { PartyManager } from "./PartyManager";
import { DungeonManager } from "./DungeonManager";
import { ClientSocketMessageSender } from "../../ws/ClientSocketMessageSender";
import { SocketMessage } from "../../types/common";

import { WebSocket } from "ws";
import { PlayerManager } from "./PlayerManager";
import { GameMAPS, isAllowedGameMap } from "../../constants/GameMapCatalog";
import { ClientGamePhase } from "../../constants/ClientGamePhase";
import { MatchQueueNotificationService } from "../../ws/services/MatchQueueNotificationService";

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

    // A단계: 매치 배정(서버 준비 전)
    ClientSocketMessageSender.broadcastMatchAssigned(match);

    for (const team of match.teams) {
      
      console.log(`[onMatchLaunched] Team ${team.teamId}: members = ${team.members.join(", ")}`);

      for (const username of team.members) {
         console.log(`  -> Processing member: ${username}`);

        const memberSession = PlayerManager.getInstance("MatchQueueManager").getPlayerSessionByUserName(username);

        if (memberSession?.ws) {
          console.log(`     ✅ Session found for ${username}, updating phase -> MatchAssigned`);
          PlayerManager.getInstance("MatchQueueManager").changeClientGamePhase(memberSession?.ws, ClientGamePhase.MatchAssigned);
        } else {
          console.warn(`     ⚠️ No active session for username=${username}`);
        }
      }
    }

  
    const { dungeonId, serverAddr, joinCredsByUser } = dm.startMatch(match);

    try {
      // DS 준비 완료까지 대기 → 최신 세션 반환
      const s = await dm.whenReady(dungeonId, 150_000, 100);

      // // 여기서 부터는 던전 준비가 끝난 뒤 실행되는 코드. 

      // /dungeonReady 로 갱신됐을 수 있는 주소를 우선 사용
      const host = s.serverHost ?? serverAddr.host;
      const port = s.serverPort ?? serverAddr.port;

      for (const team of match.teams) {
        for (const username of team.members) {
          const session = PlayerManager.getInstance("MatchQueueManager").getPlayerSessionByUserName(username);
          if (session?.ws) {
            console.log(`[MQM] Broacasting ChangeClient GamePhase to Joining Dungeon`);
            PlayerManager.getInstance("MatchQueueManager").changeClientGamePhase(session.ws, ClientGamePhase.JoiningDungeon);
          }
        }
      }

      // // B단계: 클라들에게 접속 정보 전송
      ClientSocketMessageSender.broadcastJoinDungeon(
        match,
        { host, port },
        dungeonId,
        joinCredsByUser
      );

      // console.log(`[MQM] JoinDungeon sent: ${match.matchId} -> ${host}:${port}`);
    } catch (e: any) {
      ClientSocketMessageSender.broadcastMatchFailed(
        match,
        String(e?.message || e || "UNKNOWN")
      );
      dm.endDungeonSession(dungeonId, "aborted");
      console.warn(`[MQM] DS ready failed ${match.matchId}: ${e?.message || e}`);
    } finally {
      this.refreshActive(match.mapId);
    }
  }

  private refreshActive(mapId : MapId) {
    const alive = !!this.store.dump(mapId); //  dump가 null이면 해당 맵 상태가 비어 없어졌다는 뜻 
    if (alive) this.activeMaps.add(mapId);
    else this.activeMaps.delete(mapId);
  }

  public handleMatchCancelRequest(ws : WebSocket, MapNumericID : MapId) {

    const session = PlayerManager.getInstance("MatchQueueManager").getPlayerSessionBySocket(ws);

    if (!session) {
       console.warn(`[MatchQueueManager.ts/handleMatchCancelRequest] PlayerSession Not Found `);
        return;
    }

    // 이미 MatchAssigned라면 취소를 해줄 수 없음.
    if (session.gamePhase == ClientGamePhase.MatchAssigned || session.gamePhase == ClientGamePhase.JoiningDungeon)
      return;

    const partyId = session.party_id ?? null;

    if (partyId) {

      // 모든 파티원의 매치 큐 -> 취소해 줘야 한다. 
      // MapID랑 PartyID 보내줘야 한다. 
      this.cancelParty(MapNumericID, partyId);

      // 파티에 있는 모든 클라이언트들의 GamePhase 변경
      const PartyMembers = PartyManager.getInstance().getPartyMemberUsernames(partyId);

      for (const memberName of PartyMembers) {
        const memberSession = PlayerManager.getInstance("MatchQueueManager").getPlayerSessionByUserName(memberName);
        if (memberSession?.ws)  {
            PlayerManager.getInstance("MatchQueueManager").changeClientGamePhase(memberSession?.ws, ClientGamePhase.Lobby);
        }
        // MatchQueue 탈출 패킷. 
        MatchQueueNotificationService.notifyMatchQueueCanceled(true, MapNumericID, partyId);
      }
    }

    else {
      // 솔로 큐
      this.cancelSolo(MapNumericID, session.username);

      PlayerManager.getInstance("MatchQueueManager").changeClientGamePhase(ws, ClientGamePhase.Lobby);
      MatchQueueNotificationService.notifyMatchQueueCanceled(false, MapNumericID, session.username);
    }
  }

  public handleMatchStartRequest(ws : WebSocket, MapNumericID :MapId) {
     // HTTP에서 하고 있는 내용을 여기로 가져올 것이다. 

     const session = PlayerManager.getInstance("MatchQueueManager").getPlayerSessionBySocket(ws);

     if (!session)  {
        console.warn(`[MatchQueueManager.ts/handleMatchStartRequest] PlayerSession Not Found `);
        return;
     }

     if (!isAllowedGameMap(MapNumericID))
     {
        console.warn('[MatchQueueManager.ts/handleMatchStartRequest] Invalid Map ID');
        return;
     }

     const MapDefinition = GameMAPS[MapNumericID];
     if (MapDefinition.enabled === false)
     {
      console.warn('[MatchQueueManager.ts/handleMatchStartRequest] Diabled Map'); 
     }

     const partyId = session.party_id ?? null;
     const username = session.username;
     const teampolicy = TeamJoinPolicy.Closed; // 임시 

     if (partyId)
     {
        // 파티 큐 (파티장만 허용)
        const {ticketID, isLaunched} = this.joinQueueParty(partyId, MapNumericID, teampolicy, username);

        // 파티에 있는 모든 클라이언트들의 GamePhase변경 
        const PartyMembers = PartyManager.getInstance().getPartyMemberUsernames(partyId);

        if (!isLaunched) {
          for (const memberName of PartyMembers) {
            const memberSession =  PlayerManager.getInstance("MatchQueueManager").getPlayerSessionByUserName(memberName);
            if (memberSession?.ws)
              PlayerManager.getInstance("MatchQueueManager").changeClientGamePhase(memberSession?.ws, ClientGamePhase.InMatchingQueue);
          }
        }
 
        // 2. MatchQueue 진입 패킷. 이미 Json 으로 QueueJoined 와 Queue Canceled라는 패킷을 만들어 둔 것이 있다. 
        // 이를 통해서 버튼이 Pending -> Match를 취소할 수 있도록 (파티장인 경우만), 그리고 파티원인경우에는 매치에 들어갔다는 것만
        // 알릴 수 있도록 한다. 
        MatchQueueNotificationService.notifyMatchQueueJoined(true, MapNumericID, partyId, teampolicy, ticketID);
     }

     else
     {
        // 솔로 큐 
        const {ticketID, isLaunched } = this.joinQueueSolo(username, MapNumericID, teampolicy);

        // Client에게 필요한 정보를 보내줘야 한다. 

        // 0. 큐에 들어온 사람에게 큐에 들어왔음을 알려야 한다. 
        // Client에서는 이 패킷을 보고 CurrentQueueState를 채운다. 
        MatchQueueNotificationService.notifyMatchQueueJoined(false, MapNumericID, username, teampolicy, ticketID);

        // 1. Client의 GamePhase변경 Lobby -> Matching Queue
        // 2. 그런데 이미 MatchAssigned로 변경되어 있을 수 있음. 그런 경우에는 보내면 안된다. 
        if (!isLaunched) {
          PlayerManager.getInstance("MatchQueueManager").changeClientGamePhase(ws, ClientGamePhase.InMatchingQueue);
        }
     }
  }

  public getSnapshot() {
    return this.store.getSnapshot();
  }
   
 
  // 솔로 큐 진입
  public joinQueueSolo(username : UserId, mapId : MapId, policy : TeamJoinPolicy) 
  :  { ticketID : TicketId , isLaunched : boolean}
  {
    const {ticketID , isLaunched} = this.store.enqueueSolo(mapId, username, policy);
    this.refreshActive(mapId);
    return {ticketID, isLaunched};
  }

  // 파티 큐 진입
  public joinQueueParty(partyId: number, mapId: MapId, policy: TeamJoinPolicy, requestedBy?: UserId) 
    : {ticketID : TicketId, members : string[], isLaunched : boolean}
  { 
    if (requestedBy && !PartyManager.getInstance().isHost(partyId, requestedBy)) {
     throw new Error("ONLY_HOST_CAN_QUEUE");
    }
  
    const members = PartyManager.getInstance().getPartyMemberUsernames(partyId); // ✅ 서버에서 조회
    const {ticketID, isLaunched} = this.store.enqueueParty(mapId, partyId, members, policy);
    this.refreshActive(mapId);

    // 파티큐로 입장한 파티원들에게 큐에 입장했음을 알려야함. (중복 처리되고 있는 것 같아서 일단 주석 처리 해두었음. )
    //ClientSocketMessageSender.sendToUsers(members, { type: "QueueJoined", payload: { mapId, policy, ticketId, partyId } });

    return { ticketID, members, isLaunched };
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
