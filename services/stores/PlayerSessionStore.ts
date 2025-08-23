
import { CharacterClassType } from "../../types/character";
import { PlayerSession } from "../../types/player";
import { PlayerToken } from "../../types/common";
import { WebSocket as WSWebSocket } from "ws";

export class PlayerSessionStore {
    private sessions = new Map<PlayerToken, PlayerSession>(); // 매인 
    private usernameindex = new Map<string, PlayerToken>();   // 유저 이름 인덱스
    private socketindex = new Map<WSWebSocket, PlayerToken>();

    private constructor() {}

    private static _instance : PlayerSessionStore | null = null;

    public static getInstance(caller : string) : PlayerSessionStore {
        if (caller !== "PlayerManager") {
            throw Error("Unauthorized access to PlayerSessionStore");
        }
        if (!this._instance) {
            this._instance = new PlayerSessionStore();
        }
        return this._instance;
    }

    // session 자료구조를 조작하는 함수들
    public addPlayer(playerToken : PlayerToken , playerSession : PlayerSession) {
         if (this.sessions.has(playerToken)) {
            console.warn(`[PlayerSessionStore] 이미 등록된 토큰입니다. playerToken: ${playerToken}`);
            return;
        }
        
        if (this.usernameindex.has(playerSession.username)) {
            throw new Error(`[PlayerSessionStore] session과 index간의 동기화 실패`);
        }

        this.sessions.set(playerToken, playerSession);
        this.usernameindex.set(playerSession.username, playerToken);

        if (playerSession.ws) {
            this.socketindex.set(playerSession.ws, playerToken);
        }
    }

     /**
     * @description 주어진 토큰에 해당하는 플레이어 세션을 업데이트합니다.
     * @param playerToken 업데이트할 플레이어의 토큰
     * @param playerSession 업데이트할 새로운 세션 데이터
     */
    public updatePlayer(playerToken: PlayerToken, playerSession: PlayerSession) {
        if (!this.sessions.has(playerToken)) {
            console.error(`[PlayerSessionStore] 업데이트할 토큰이 존재하지 않습니다. playerToken: ${playerToken}`);
            return;
        }

        this.sessions.set(playerToken, playerSession);
    }

    public removePlayer(playerToken : PlayerToken) {
        const session = this.sessions.get(playerToken);

        if (!session) {
            throw new Error(`[PlayerSessionStore] 관리 중이지 않은 토큰입니다`);
        }

        if (!this.usernameindex.has(session.username)) {
            throw new Error(`[PlayerSessionStore] session과 index간의 동기화 실패`);
        }

        this.sessions.delete(playerToken);
        this.usernameindex.delete(session.username);

        const currentWs = session.ws;
        if (currentWs && this.socketindex.get(currentWs) === playerToken) {
            this.socketindex.delete(currentWs);
        }
    }


     /**
     * @description 주어진 유저 이름에 해당하는 플레이어 토큰을 반환합니다.
     * @param username 찾을 플레이어의 이름
     * @returns 플레이어 토큰 또는 undefined
     */
    public getPlayerTokenByUserName(username: string): PlayerToken | undefined {
        return this.usernameindex.get(username);
    }

    public getPlayerSessionByToken(token : PlayerToken) : Readonly<PlayerSession> | undefined {
        return this.sessions.get(token);
    }

    public getPlayerSessionByUserName(username : string) : Readonly<PlayerSession> | undefined {
        const token = this.usernameindex.get(username);
        if(!token) return undefined;
        return this.sessions.get(token);
    }

    public setClassTypeByToken(token: PlayerToken, classType: CharacterClassType): Readonly<PlayerSession> | undefined {
        const s = this.sessions.get(token);
        if (!s) return undefined;

        if (s.classType === classType) return Object.freeze({ ...s }); // No-op

        const updated: PlayerSession = { ...s, classType };
        this.sessions.set(token, updated);
        return Object.freeze({ ...updated });
    }

    public setClassTypeBySocket(ws: WSWebSocket, classType: CharacterClassType): Readonly<PlayerSession> | undefined {
        const token = this.socketindex.get(ws);
        if (!token) return undefined;
        return this.setClassTypeByToken(token, classType);
    }

    public getPlayerSessionBySocket(ws : WSWebSocket) : Readonly<PlayerSession> | undefined {
        const token = this.socketindex.get(ws);
        if(!token) return undefined;
        return this.sessions.get(token);
    }

    public RegisterPlayerSocket(token : PlayerToken, ws : WSWebSocket) : boolean {
        const playerSession = this.sessions.get(token);
        if (!playerSession) return false;

        playerSession.ws = ws;
        this.socketindex.set(ws, token); 
        return true;
    }

    public getAllSessions() : Readonly<PlayerSession>[] {
        return Array.from(this.sessions.values());
    }

    public getAllLobbyUserNameAndClass() : {username : string; classType : string}[] {
        return Array.from(this.sessions.values()).map(session => ({
            username :session.username,
            classType : session.classType
        }));
    }
}