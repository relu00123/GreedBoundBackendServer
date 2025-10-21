import { PlayerToken } from "../../types/common";
import { PlayerSession } from "../../types/player";
import { CharacterClassType } from "../../types/character";
import { PlayerSessionStore} from "../stores/PlayerSessionStore";
import { WebSocket as WSWebSocket } from "ws";
import { PartyManager } from "./PartyManager";
import { ClientGamePhase } from "../../constants/ClientGamePhase";
import { ClientSocketMessageSender } from "../../ws/ClientSocketMessageSender";
import { PlayerNotificationService } from "../../ws/services/PlayerNotificationService";

export class PlayerManager {
    private static _instance : PlayerManager | null = null;

    // PlayerSession Cache
    private playerSessionStore = PlayerSessionStore.getInstance("PlayerManager");

    private constructor() {}

    public static getInstance(caller : string) : PlayerManager {
        return this._instance ??= new PlayerManager();
    }

    public registerPlayerSession(playerToken : PlayerToken, session : PlayerSession) {
        this.playerSessionStore.addPlayer(playerToken,session);
    }

    public registerPlayerSocket(playerToken : PlayerToken, ws : WSWebSocket) : boolean {
        return this.playerSessionStore.RegisterPlayerSocket(playerToken, ws);
    }

    public removePlayerSession(playerToken : PlayerToken) {
        this.playerSessionStore.removePlayer(playerToken);
    }

    public hasPlayerByToken(token : PlayerToken) : boolean {
        return this.playerSessionStore.getPlayerSessionByToken(token) !== undefined;
    }

    public hasPlayerByUserName(playername : string) : boolean {
        return this.playerSessionStore.getPlayerSessionByUserName(playername) !== undefined;
    }

    public getPlayerSessionByToken(token : PlayerToken) : Readonly<PlayerSession> | undefined {
        return this.playerSessionStore.getPlayerSessionByToken(token);
    }

    public getPlayerSessionByUserName(username : string) : Readonly<PlayerSession> | undefined {
        return this.playerSessionStore.getPlayerSessionByUserName(username);
    }

    public getPlayerSessionBySocket(ws : WSWebSocket) : Readonly<PlayerSession> | undefined {
        return this.playerSessionStore.getPlayerSessionBySocket(ws);
    }

    public GetAllPlayerSession() : Readonly<PlayerSession>[] {
        return this.playerSessionStore.getAllSessions();
    }

    public getAllLobbyUserNameAndClass() : { username: string, classType : string}[] {
        return this.playerSessionStore.getAllLobbyUserNameAndClass();
    }

    public setClassTypeBySocket(ws: WSWebSocket, classType: CharacterClassType): Readonly<PlayerSession> | undefined {
        // 1) 현재 스냅샷 조회
        const cur = this.playerSessionStore.getPlayerSessionBySocket?.(ws);
        if (!cur) return undefined;

        // 2) 동일 값이면 바로 현재 스냅샷 반환 (No-op)
        if (cur.classType === classType) return cur;

        // 3) Store에 위임해서 변경(뮤테이터 필요)
        const updated = this.playerSessionStore.setClassTypeBySocket?.(ws, classType);
        return updated ?? undefined;
    }

    /**
     * @description 주어진 플레이어의 세션 정보를 부분적으로 업데이트합니다.
     * @param username 업데이트할 플레이어의 이름
     * @param updates 업데이트할 속성들을 담은 객체
     * @returns 업데이트 성공 여부 (boolean)
     */
    public updatePlayerSession(username: string, updates: Partial<PlayerSession>): boolean {
        const playerToken = this.playerSessionStore.getPlayerTokenByUserName(username);
        if (!playerToken) {
            console.error(`Player with username ${username} not found.`);
            return false;
        }

        const session = this.playerSessionStore.getPlayerSessionByUserName(username);
        if (!session) {
            console.error(`Player session for username ${username} not found.`);
            return false;
        }

        // 기존 세션에 업데이트 내용을 병합하여 새로운 객체를 생성
        const updatedSession: PlayerSession = { ...session, ...updates };
        
        // PlayerSessionStore의 updatePlayer 함수를 사용하여 세션 정보를 업데이트합니다.
        this.playerSessionStore.updatePlayer(playerToken, updatedSession);

        return true;
    }

    public handleLogoutByToken(caller : string, token : PlayerToken) : { ok: boolean; reason?: string} {
        const session = this.getPlayerSessionByToken(token);
        if(!session) return { ok: false, reason: "NO_SESSION"};

        // 파티가 있을 경우
        const partyId = session.party_id;
        if (partyId != null) {
            const partyMgr = PartyManager.getInstance();

            partyMgr.removeMember(partyId, session.username);
        }

        this.removePlayerSession(token);
        return { ok :true};
    }

    public changeClientGamePhase(RequestSocket : WSWebSocket, TargetGamePhase : ClientGamePhase) {
        // 1. 소캣으로부터 플레이어 세션 찾기
        const playerSession = this.getPlayerSessionBySocket(RequestSocket);
        if (!playerSession) {
            console.warn("[PlayerManager.ts] PlayerSession not found");
            return;
        }

        const previousGamePhase = playerSession.gamePhase;

        // 2. 해당 플레이어 세션의 GamePhase 업데이트
        this.updatePlayerSession(playerSession?.username, {gamePhase: TargetGamePhase});

        const snapshot = this.getPlayerSessionByUserName(playerSession.username);

        if (snapshot) {
            PlayerNotificationService.notifyGamePhaseChanged(playerSession.username, previousGamePhase, TargetGamePhase, snapshot);
        }

        // Legacy Logic Starts
        // 2.1 (자기 자신에게의 GamePhase는 전용 패킷을 통해서 알리도록 한다.)

        // 3. 모든 클라이언트들에게 BroadCast
        // - 이 부분이 비효율적인것은 인지 하고 있음.
        // - 예를들어서 던전에 있는 사람이 로비에 있는 특정인원이 offline으로 변경된 것 까지는 알필요가 없다.
        // - 닼닼이라면 게임이 끝나고 로비 복귀시에 서버에 있는 인원 (ex : 10000명) 중 일부 (ex : 1000) 명의 정보를 받아서
        // - 로비에 알려서 UI반영 및 초대등의 기능이 가능하도록 할 것 같다. 
        // - 하지만 연습 프로젝트이기에 Client에 Server의 UserState와 동기화를 하는 단순화된 방식으로 구현하겠음. 
        // const snapshot = this.getPlayerSessionByUserName(playerSession.username);

        // if (snapshot) {
        //     console.log(`broadcasting Player Session Updates!!!! [phase] ${playerSession.username} : ${previousGamePhase} -> ${TargetGamePhase}`);
        //     ClientSocketMessageSender.broadcastPlayerSessionUpdatedToAll(snapshot, { gamePhase : TargetGamePhase});
        // }
        // Legacy Logic Ends
    }

    public handleGamePhaseChangeRequset(RequestSocket : WSWebSocket , TargetGamePhase : ClientGamePhase) {
        
         this.changeClientGamePhase(RequestSocket, TargetGamePhase);
    }

    public handleLobbyUserListRequest(RequestSocket : WSWebSocket) {

        console.log("LobbyUserListRequest Received");

        const LobbyUsers = this.GetAllPlayerSession();

        console.log("🧍 Currently Connected Users:");
        LobbyUsers.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.username} (${user.classType})`);
        });

        ClientSocketMessageSender.sendLobbyUserList(RequestSocket, LobbyUsers);
    }
}