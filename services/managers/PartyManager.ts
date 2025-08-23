import { PartySessionStore } from "../stores/PartySessionStore";
import { PartyID, PartySession, PartyMember } from "../../types/party";
import { PartyNotificationService } from "../../ws/services/PartyNotificationService";
import { BroadcastSocketMessageUtils } from "../../utils/BroadcastSocketMessageUtils";

export class PartyManager {
    private static _instance: PartyManager | null = null;

    private store: PartySessionStore; 
    private notificationService : PartyNotificationService; // 알림 서비스 인스턴스 
    private lastPartyID: number = 0;

    private constructor() {
        // PartyManager만이 PartySessionStore에 접근 가능하도록 호출자 이름을 전달합니다.
        this.store = PartySessionStore.getInstance("PartyManager");
        this.notificationService = new PartyNotificationService();
    }

    /**
     * @description PartyManager의 싱글톤 인스턴스를 반환합니다.
     * @returns PartyManager의 유일한 인스턴스
     */
    public static getInstance(): PartyManager {
        // 인스턴스가 없으면 새로 생성하고, 있으면 기존 인스턴스를 반환합니다.
        if (!this._instance) {
            this._instance = new PartyManager();
        }
        return this._instance;
    }


     /**
     * @description username 정보로 PartyMember 객체를 생성하는 헬퍼 함수
     * @param username 멤버의 이름
     * @returns PartyMember 객체
     */
    private createPartyMemberFromUsername(username: string): PartyMember {
        return {
            username: username
        };
    }


    /**
     * 1. 파티 개설
     */
    public createParty(hostName: string): PartyID {
        const newID: PartyID = ++this.lastPartyID;
        const hostMember = this.createPartyMemberFromUsername(hostName);
        
        const newSession: PartySession = {
            partyId: newID,
            hostName: hostMember.username,
            members: [hostMember],
        };

        this.store.createSession(newID, newSession);

        return newID;
    }

     
    /**
     * 2. 파티원 추가
     * @description 주어진 파티에 새로운 멤버를 추가합니다.
     * @param partyID 멤버를 추가할 파티의 ID
     * @param newMember 추가할 멤버 객체 또는 이름(string)
     */
    public addMember(partyID: PartyID, newMember: PartyMember | string): boolean {
        const session = this.store.getSession(partyID);

        if (!session) {
            console.error("Party not found.");
            return false;
        }

        let memberToAdd: PartyMember;
        if (typeof newMember === 'string') {
            memberToAdd = this.createPartyMemberFromUsername(newMember);
        } else {
            memberToAdd = newMember;
        }
        
        // 멤버 추가 로직
        session.members.push(memberToAdd);
        this.store.updateSession(partyID, session);

        return true;
    }

    /**
     * 파티원 탈퇴
     * @description 주어진 파티에서 멤버를 제거합니다. 호스트 탈퇴 시 호스트를 위임하고, 마지막 멤버가 탈퇴하면 파티를 삭제합니다.
     * @param partyID 멤버가 탈퇴할 파티의 ID
     * @param memberName 탈퇴하는 멤버의 이름
     */
    public removeMember(partyID: PartyID, memberName: string): void {
        const session = this.store.getSession(partyID);

        if (!session) {
            console.error("Party not found.");
            return;
        }

        const memberIndex = session.members.findIndex(member => member.username === memberName);
        if (memberIndex === -1) {
            console.error("Member not found in the party.");
            return;
        }
        
        session.members.splice(memberIndex, 1);

        if (session.members.length === 0) {
            this.store.deleteSession(partyID);
        }
        else if (session.hostName === memberName) {
            session.hostName = session.members[0].username;
            this.store.updateSession(partyID, session);
        }
        else {
            this.store.updateSession(partyID, session);
        }
    }

     /**
     * 파티장 위임
     * @description 파티 호스트를 새로운 멤버에게 위임합니다.
     * @param partyID 호스트를 위임할 파티의 ID
     * @param newHostName 새로운 호스트의 이름
     */
    public transferHost(partyID: PartyID, newHostName: string): void {
        const session = this.store.getSession(partyID);

        if (!session) {
            console.error("Party not found.");
            return;
        }
        
        const isMember = session.members.some(member => member.username === newHostName);
        if (!isMember) {
            console.error("New host is not a member of the party.");
            return;
        }
        
        session.hostName = newHostName;
        this.store.updateSession(partyID, session);
    }

    /**
     * 특정 파티의 정보 가져오기
     * @description 특정 파티의 정보를 가져옵니다.
     * @param partyId 조회할 파티의 ID
     * @returns PartySession 또는 undefined
     */
    public getParty(partyId: PartyID): Readonly<PartySession> | undefined {
        return this.store.getSession(partyId);
    }

     

}