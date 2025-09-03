import { PartySessionStore } from "../stores/PartySessionStore";
import { PartyID, PartySession, PartyMember, RemoveMemberResult } from "../../types/party";
import { PartyNotificationService } from "../../ws/services/PartyNotificationService";
import { BroadcastSocketMessageUtils } from "../../utils/BroadcastSocketMessageUtils";
import { PlayerManager } from "./PlayerManager";
import { WebSocket } from "ws";

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

    private pickNewHost(session : PartySession) : string | null {
        // 단순히 현제 맨 앞 멤버로. 나중에 로직 수정 필요시 변겨하면 된다.
        return session.members.length > 0 ? session.members[0].username : null;
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
    public removeMember(partyID: PartyID, memberName: string): RemoveMemberResult {
        const session = this.store.getSession(partyID);

        const oldHost = session?.hostName;

        if (!session) {
            console.error("Party not found.");
            return { ok : false, reason : "PARTY_NOT_FOUND"};
        }

        const memberIndex = session.members.findIndex(member => member.username === memberName);
        if (memberIndex === -1) {
            console.error("Member not found in the party.");
            return { ok : false, reason : "MEMBER_NOT_FOUND"};
        }

        const wasHost = session.hostName === memberName;

        // 1. 멤버 제거        
        session.members.splice(memberIndex, 1);

        // 현재 남은 파티원들 알림
        console.log(`[PartyManager.ts] 남은 파티인원 목록 : 파티 ID : ${session.partyId}, 파티원 목록 ${JSON.stringify(session.members)}`);


        // 2. 결과 분기
        if (session.members.length === 0) {
             console.log(`[PartyManager.ts] 파티 ID ${session.partyId}의 멤버가 0명입니다. 파티를 해산합니다.`);

            // 파티 해산 및 멤버 탈되
            PartyNotificationService.notifyMemberLeft(partyID, memberName); // 파티장 자기 자신이라 의미 없을 듯..?
            PartyNotificationService.notifyPartyDisbanded(partyID);

            // 파티 해산
            this.store.deleteSession(partyID);

            return { ok: true, wasHost, isDisbanded : true};
        }

        let newHost: string | undefined;

        if (wasHost) {
            // 호스트 위임
            const picked = this.pickNewHost(session);
            if (picked) {
                session.hostName = picked;
                newHost = picked; 
            }
        }

        // 저장
        this.store.updateSession(partyID, session);

        // 알림
        //  
         PartyNotificationService.notifyMemberLeft(partyID, memberName);
        if (wasHost && newHost && oldHost) {
            PartyNotificationService.notifyHostTransferred(partyID, oldHost, newHost)
        }

        return {
            ok : true,
            wasHost,
            isDisbanded : false,
            newHost,
            party : this.store.getSession(partyID),  // 변경 후 스냅샷 
        };
 
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


     /**
     * @description 특정 멤버가 해당 파티의 파티장인지 확인합니다.
     * @param partyID 파티의 ID
     * @param targetNickname 확인할 멤버의 닉네임
     * @returns true면 파티장, false면 아님
     */
    public isHost(partyID: PartyID, targetNickname: string): boolean {
        const session = this.store.getSession(partyID);

        if (!session) {
            console.error("Party not found.");
            return false;
        }

        return session.hostName === targetNickname;
    }

    public isInAnyParty(username : string) : PartyID | null {
        const userSession =  PlayerManager.getInstance("PartyManager").getPlayerSessionByUserName(username);

          if (!userSession) {
            return null;
        }

        return userSession.party_id ?? null;
    }

    public handlePartyInviteRequest(inviterWebSocket : WebSocket, inviteeName : string)  {

        const inviterPlayer = PlayerManager.getInstance("PartyMessageHandler").getPlayerSessionBySocket(inviterWebSocket);
        const inviteePlayerSession = PlayerManager.getInstance("PartyManager").getPlayerSessionByUserName(inviteeName);

        if (!inviterPlayer) {
            console.log("inviter Player Does not Exists");
            PartyNotificationService.sendPartyInviteResponse(inviterWebSocket , { success: false, error: "NOT_AUTHENTICATED" });
            return;
        }

        if (!inviteePlayerSession) {
            console.log("invitee player does not exists");
            PartyNotificationService.sendPartyInviteResponse(inviterWebSocket, { success: false, error: "INVITEE_NOT_FOUND" });
            return;
        }

        const inviterPartyId = this.isInAnyParty(inviterPlayer.username);
        const inviteePartyId = this.isInAnyParty(inviteeName);

        if (inviteePartyId !== null)
        {
            PartyNotificationService.sendPartyInviteResponse(inviterWebSocket, {success:false, error : "INVITEE_ALREADY_IN_PARTY", inviteeName : inviteeName});
            return;
        }

        // 초대를 받은 사람에게 알림을 보낸다. 
        if (inviteePlayerSession?.ws && inviterPlayer) {
            PartyNotificationService.sendPartyInviteNotification(inviteePlayerSession.ws, inviterPlayer.username);
        }
    }

     

}