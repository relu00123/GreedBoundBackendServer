

export type PartyID = number;

/**
 * @description 파티 멤버의 정보를 담는 인터페이스.
 * 기존 PartySession.members가 string[] 이었으나, 더 자세한 정보를 담기 위해 객체로 변경합니다.
 */
export interface PartyMember {
    username: string;
    // 필요한 경우, 여기에 다른 멤버 정보를 추가할 수 있습니다. (예: status, characterId 등)
}


export interface PartySession {
    partyId: PartyID; 
    hostName: string;
    members: PartyMember[];
}

/**
 * @description 멤버가 파티에 합류했음을 알리는 메시지의 페이로드입니다.
 */
export interface PartyMemberJoined {
  partyId: PartyID;
  memberName: string;
}

/**
 * @description 멤버가 파티를 떠났음을 알리는 메시지의 페이로드입니다.
 */
export interface PartyMemberLeft {
  partyId: PartyID;
  memberName: string;
}

/**
 * @description 파티 호스트가 변경되었음을 알리는 메시지의 페이로드입니다.
 */
export interface PartyHostTransferred {
  partyId: PartyID;
  oldHostName: string;
  newHostName: string;
}

export interface RemoveMemberResult {
  ok : boolean;
  reason? : "PARTY_NOT_FOUND" | "MEMBER_NOT_FOUND";
  wasHost? : boolean;
  isDisbanded? : boolean;
  newHost? : string;
  party? : Readonly<PartySession>; // 변경 후 스냅샷 
}
