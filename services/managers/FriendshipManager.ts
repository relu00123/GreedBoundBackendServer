import { FriendshipStore, FriendRow, PendingRequestRow } from "../stores/FriendshipStore";

export class FriendshipManager {

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

  static async getFriendList(userId: string): Promise<FriendRow[]> {
    return await FriendshipStore.getFriendList(userId);
  }

  static async getIncomingRequests(userId: string): Promise<PendingRequestRow[]> {
    return await FriendshipStore.getPendingRequests(userId);
  }
}