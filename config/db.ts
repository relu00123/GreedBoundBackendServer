import dotenv from "dotenv";
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";   

dotenv.config();

// 데이터 베이스에 매번 새 연결을 만드는 대신,
// 일정 수의 연결을 만들어 미리 사용할 수 있도록 한다. 
const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;