import mysql from "mysql2/promise";
import pool from "../config/db";

export async function initAccountsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `;

    await pool.execute(createTableQuery);
    console.log("✅ accounts 테이블 생성 완료");
  } catch (err) {
    console.error("❌ accounts 테이블 생성 실패:", err);
  }
}