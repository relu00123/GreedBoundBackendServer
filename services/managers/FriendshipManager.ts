import { ClientSocketMessageSender } from "../../ws/ClientSocketMessageSender";
import { FriendshipStore, FriendRow, PendingRequestRow, SentRequestRow } from "../stores/FriendshipStore";
import { PlayerManager } from "./PlayerManager";

export class FriendshipManager {
 
  static async HandleAddFriendRequest(userId : string, targetId: string) : Promise<void> {

    // DB에 요청 저장
    await this.sendFriendRequest(userId, targetId);

    // 상대방이 온라인이면 알림 전송 (미완성)
    const receiverSession = PlayerManager.getInstance("FriendshipManager").getPlayerSessionByUserName(targetId);
    if (receiverSession)
    {
      console.log(`현재 ${targetId}가 로그인 중입니다! ${targetId}에게 친구추가 받음 packet을 보냅니다`);
      const targetSession = PlayerManager.getInstance("FriendshipManager").getPlayerSessionByUserName(targetId);
      if (targetSession?.ws)
      {
      ClientSocketMessageSender.sendFriendRequestReceived(targetSession.ws, { user_id : userId});
      }
      
    }
  }

  static async sendFriendRequest(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) {
      throw new Error("자기 자신에게 친구 요청을 보낼 수 없습니다.");
    }

    const existing = await FriendshipStore.getFriendship(userId, targetId);
    if (existing.length > 0) {
      throw new Error("이미 친구 요청을 보냈거나 친구 상태입니다.");
    }

    await FriendshipStore.addFriendRequest(userId, targetId);
  }


  // 친구 추가 요청 철회
  static async handleWithdrawFriendRequest(senderId: string, receiverId: string) :Promise<void> {
    // 1. DB에서 친구 요청 삭제
    await FriendshipStore.removeFriendRequest(senderId, receiverId);

    // 2. 요청 보낸 사람의 캐시에서 제거 (온라인일 경우)
    const senderSession = PlayerManager.getInstance("FriendshipManager").getPlayerSessionByUserName(senderId);
    if (senderSession && senderSession.ws) 
    {
      ClientSocketMessageSender.sendDeleteSentFriendRequest(senderSession.ws, receiverId);
    }

    // 3. 요청 받은 사람의 캐시에서 제거 (온라인일 경우)
    const receiverSession = PlayerManager.getInstance("FriendshipManager").getPlayerSessionByUserName(receiverId);
    if (receiverSession && receiverSession.ws)
    {
      ClientSocketMessageSender.sendDeleteReceivedFriendRequest(receiverSession.ws, senderId);
    }
  }


  // 양방향 친구 추가 
  static async acceptFriendRequest(userId: string, targetId: string): Promise<void> {
    await FriendshipStore.acceptFriendRequest(targetId, userId);       // A → B
    await FriendshipStore.addFriendRequest(userId, targetId);         // B → A
    await FriendshipStore.acceptFriendRequest(userId, targetId);      // 상태 변경
  }

  // 양방향 친구 삭제
  static async removeFriend(userId: string, targetId: string): Promise<void> {
    await FriendshipStore.deleteFriend(userId, targetId);
    await FriendshipStore.deleteFriend(targetId, userId);
  }

    // 특정 유저의 친구 목록 가져오기
  static async getFriendList(userId: string): Promise<FriendRow[]> {
    return await FriendshipStore.getFriendList(userId);
  }

  // 특정 유저의 받은 친구추가 목록 가져오기
  static async getIncomingRequests(userId: string): Promise<PendingRequestRow[]> {
    return await FriendshipStore.getPendingRequests(userId);
  }

  // 특정 유저의 보낸 친구추가 목록 가져오기 
  static async getSentRequest(userId: string): Promise<SentRequestRow[]> {
    return await FriendshipStore.getSentRequest(userId);
  }

  
}