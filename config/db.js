require("dotenv").config(); 

const mysql = require("mysql2/promise");

// 매번 요청마다 connect() / disconnect() 하는 것은 비효율적 
// 연결을 미리 여러개 만들어두고 재사용하면 성능이 향상됨
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;