import {PlayerToken, PlayerSession, CharacterClassType} from "../../types/types";
import { PlayerSessionStore} from "../stores/PlayerSessionStore";
import { WebSocket as WSWebSocket } from "ws";

export class PlayerManager {
    private static _instance : PlayerManager | null = null;

    // PlayerSession Cache
    private playerSessionStore = PlayerSessionStore.getInstance("PlayerManager");

    private constructor() {}

    public static getInstance(caller : string) : PlayerManager {

        // 불릴 수 있는 클래스들을 지정해야함.. 
        // if (caller != "...") {
        //     throw new Error("Unauthorized access to DungeonManager");
        // }
        // 사용중인 클래스 목록
        // auth.ts 
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
}