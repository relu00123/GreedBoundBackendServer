// stores/dungeonSessionStore.ts

import { DungeonSession, MapType } from "../../types/dungeon";
import { DungeonToken, PlayerToken } from "../../types/common";
import { WebSocket as WSWebSocket } from "ws";

export class DungeonSessionStore {
    private sessions = new Map<DungeonToken, DungeonSession>();

    private constructor() {}

    // 이 변수의 Type은 DungeonSessionStore이거나 null, 초기값으로 null값을 설정한다. 
    private static _instance: DungeonSessionStore | null = null;

    public createDungeonSession(token : DungeonToken, players : PlayerToken[], mapType : MapType, instanceNumber : number) {
        if (this.sessions.has(token)) {
            throw new Error(`[DungeonSessionStore] 이미 존재하는 새션입니다. token ${token}`);
        }

        this.sessions.set(token, {
            mapType,
            instanceNumber,
            players : [...players]
        });
    }

    // getInstance(caller : string) -> caller라는이름의 문자열(string)을 받는다. 
    // : DungeonSessionStore -> 이 함수는 DungeonSessionStore type을 반환한다.
    public static getInstance(caller: string): DungeonSessionStore {
        if (caller !== "DungeonManager") {
            throw Error("Unauthorized access to DungeonSessionStore");
        }
        if (!this._instance) {
            this._instance = new DungeonSessionStore();
        }
        return this._instance;
    }

    // session 자료구조를 조작하는 함수들. 
    public addPlayer(dungeonToken : DungeonToken , playerToken : PlayerToken) {
        const session = this.sessions.get(dungeonToken);
        if (!session) {
            console.warn(`[DungeonSessionStore] 세션이 존재하지 않음. token: ${dungeonToken}`);
            return;
        }
        if (session.players.includes(playerToken)) {
            console.log(`[DungeonSessionStore] 이미 등록된 플레이어입니다. playerToken: ${playerToken}`);
        }
        else {
            session.players.push(playerToken);
            console.log(`[DungeonSessionStore] 플레이어 추가됨. token: ${dungeonToken}, playerToken: ${playerToken}`);
        }
    }

    public removePlayer(dungeonToken : DungeonToken, playerToken : PlayerToken) {
        const dungeonSession = this.sessions.get(dungeonToken);

         if (!dungeonSession) {
             console.warn(`[DungeonSessionStore] 세션이 존재하지 않음. token: ${dungeonToken}`);
            return;
        }

        const index = dungeonSession.players.indexOf(playerToken);
        if (index === -1) {
            console.log(`[DungeonSessionStore] 제거할 플레이어가 세션에 존재하지 않음. playerToken: ${playerToken}`); // playerToken출력이아니라 playerID를 출력해야함.
        } 
        else {
            dungeonSession.players.splice(index, 1);
            console.log(`[DungeonSessionStore] 플레이어 제거됨. token: ${dungeonToken}, playerToken: ${playerToken}`);
        }
    }

    // get()으로 Session을 가져오려고 한다.
    // ?.players -> 세션이 존재할때만 players에 접근한다.
    // ?? [] -> undefined이거나 null이면 빈 배열로 대체한다. 
    public getAllPlayers(dungeonToken :DungeonToken) : PlayerToken[] {
        return this.sessions.get(dungeonToken)?.players ?? [];
    }

    public printAllPlayers(dungeonToken :DungeonToken) {
        const players = this.getAllPlayers(dungeonToken);

        if (players.length == 0) {
            console.log(`[DungeonSessionStore] 던전에 등록된 플레이어가 없습니다. token: ${dungeonToken}`);
            return;
        }

        console.log(`[DungeonSessionStore] 던전 token : ${dungeonToken}의 플레이어 목록:`);

        players.forEach((playerToken, index) => {
            console.log(`  ${index + 1}. playerToken: ${playerToken}`);
        });
    }

    public deleteSession(dungeonToken : DungeonToken) {
        this.sessions.delete(dungeonToken);
        console.log(`[DungeonSessionStore] 던전 인스턴스 제거 완료 : ${dungeonToken}`);
    }

    public getDungeonSession(token : DungeonToken) : Readonly<DungeonSession> | undefined {
        return this.sessions.get(token);
    }

    public registerSocket(token : DungeonToken, ws : WSWebSocket) : boolean {
        const dungeonsession = this.sessions.get(token);
        if (!dungeonsession) return false;
        dungeonsession.ws = ws;
        return true;
    }
}