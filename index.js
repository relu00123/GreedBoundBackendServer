require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const playerRoutes = require("./routes/player");

const { setupSocket } = require("./ws/socketHandler");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// 🌐 미들웨어
app.use(cors());
app.use(express.json());

// 🔗 라우터 연결
app.use("/", authRoutes);         // ✅ /login, /logout, /register
app.use("/match", matchRoutes);  // ✅ /match/start
app.use("/players", playerRoutes); // ✅ /players, /players/:username/status

// 🔌 WebSocket 처리
setupSocket(wss);

// ✅ 테스트용 엔드포인트
app.get("/", (req, res) => {
  res.send("🟢 Node 서버가 잘 실행되고 있어요!");
});

// ✅ 서버 실행
server.listen(PORT, () => {
  console.log(`🚀 Game Backend Server is running on http://localhost:${PORT}`);
});