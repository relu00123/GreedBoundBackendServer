import pool from "../../config/db";

export interface FriendRow {
  friend_id: string;
}

export interface PendingRequestRow {
  user_id: string;
}

export interface FriendshipRow {
  user_id: string;
  friend_id: string;
  status: string;
  created_at?: Date;  // created_at 컬럼이 있다면
  updated_at?: Date;  // updated_at 컬럼이 있다면
}

// 친구 시스템과 관련된 DB접근 로직만 담당한다.
export class FriendshipStore {

  // 친구 요청 추가
  static async addFriendRequest(userId: string, targetId: string): Promise<void> {
    const sql = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES (?, ?, 'pending')
    `;
    await pool.execute(sql, [userId, targetId]);
  }

  // 친구 수락
  static async acceptFriendRequest(userId: string, targetId: string): Promise<void> {
    const sql = `
      UPDATE friendships
      SET status = 'accepted'
      WHERE user_id = ? AND friend_id = ?
    `;
    await pool.execute(sql, [userId, targetId]);
  }

  // 친구 삭제 (단방향)
  static async deleteFriend(userId: string, targetId: string): Promise<void> {
    const sql = `
      DELETE FROM friendships
      WHERE user_id = ? AND friend_id = ?
    `;
    await pool.execute(sql, [userId, targetId]);
  }

  // 친구 목록 조회 (수락된 것만)
  static async getFriendList(userId: string): Promise<FriendRow[]> {
    const sql = `
      SELECT friend_id FROM friendships
      WHERE user_id = ? AND status = 'accepted'
    `;
    const [rows] = await pool.execute(sql, [userId]);
    return rows as FriendRow[];
  }

  // 특정 관계 조회
  static async getFriendship(userId: string, targetId: string): Promise<FriendshipRow[]> {
    const sql = `
        SELECT * FROM friendships
        WHERE user_id = ? AND friend_id = ?
    `;
    const [rows] = await pool.execute(sql, [userId, targetId]);
    return rows as FriendshipRow[];
}

  // 나에게 온 친구 요청 목록
  static async getPendingRequests(userId: string): Promise<PendingRequestRow[]> {
    const sql = `
      SELECT user_id FROM friendships
      WHERE friend_id = ? AND status = 'pending'
    `;
    const [rows] = await pool.execute(sql, [userId]);
    return rows as PendingRequestRow[];
  }
}