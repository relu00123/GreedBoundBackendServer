import mysql from "mysql2/promise";
import pool from "../config/db";

export async function initFriendshipTable() {
    try {
        // friendships 테이블은 친구 관계를 단방향으로 표현합니다.
        // - (user_id → friend_id)는 한 방향의 친구 요청 또는 관계를 나타냅니다.
        // - status로 친구 상태(pending, accepted, blocked)를 관리합니다.
        // - UNIQUE KEY uinque_friendship (user_id, friend_id)로 같은 친구를 중복 추가하지 않도록 합니다.
        // - 양방향 친구 관계는 (A, B), (B, A) 두 레코드가 필요합니다.
        // - deleted_at으로 소프트 삭제를 지원할 수 있습니다.
        // - 인덱스는 빠른 조회를 위해 추가합니다.

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS friendships (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                friend_id VARCHAR(64) NOT NULL,
                status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at DATETIME DEFAULT NULL,
                UNIQUE KEY unique_friendship (user_id, friend_id),
                INDEX idx_user (user_id),
                INDEX idx_friend (friend_id)
            );
        `;

        await pool.execute(createTableQuery);
        console.log("✅ friendships 테이블 생성 완료");
    } catch (err) {
        console.error("❌ friendships 테이블 생성 실패:", err);
    }
}
