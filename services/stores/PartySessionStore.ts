
import { PartyID, PartySession } from "../../types/party";


export class PartySessionStore {
    private sessions = new Map<PartyID, PartySession>;

    private constructor() {}
    
    private static _instance : PartySessionStore | null = null;

    public static getInstance(caller : string) : PartySessionStore {
        if (caller !== "PartyManager") {
            throw Error("Unauthorized access to PartySessionStore");
        }

        if (!this._instance) {
            this._instance = new PartySessionStore();
        }

        return this._instance;
    }

    // PartySession 자료구조를 조작하는 함수들 

     /**
     * @description 새로운 파티 세션을 추가합니다.
     * @param id 추가할 파티의 고유 ID
     * @param session 추가할 파티 세션 데이터
     */
    public createSession(id: PartyID, session: PartySession) : void {
        this.sessions.set(id, session);
    }


    /**
     * @description 주어진 ID에 해당하는 파티 세션 데이터를 반환합니다.
     * @param id 검색할 파티의 고유 ID
     * @returns PartySession 객체 또는 해당 ID의 파티가 없으면 undefined
     */
    public getSession(id: PartyID): PartySession | undefined {
        return this.sessions.get(id);
    }

    /**
     * @description 주어진 ID에 해당하는 파티 세션을 업데이트합니다.
     * @param id 업데이트할 파티의 고유 ID
     * @param session 업데이트할 새로운 파티 세션 데이터
     */
    public updateSession(id: PartyID, session: PartySession): void {
        this.sessions.set(id, session);
    }

    /**
     * @description 주어진 ID에 해당하는 파티 세션을 삭제합니다.
     * @param id 삭제할 파티의 고유 ID
     */
    public deleteSession(id: PartyID): void {
        this.sessions.delete(id);
    }

    /**
     * @description 주어진 ID에 해당하는 파티 세션이 존재하는지 확인합니다.
     * @param id 확인할 파티의 고유 ID
     * @returns 존재하면 true, 아니면 false
     */
    public hasSession(id: PartyID): boolean {
        return this.sessions.has(id);
    }
}