import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import http from "http";
import WebSocket from "ws";

import authRoutes from "./routes/auth";
import matchRoutes from "./routes/match";
import playerRoutes from "./routes/player";

import { setupSocket } from "./ws/socketHandler";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// 🌐 미들웨어
app.use(cors());
app.use(express.json());

// 🔗 라우터 연결
app.use("/", authRoutes);
app.use("/match", matchRoutes);
app.use("/players", playerRoutes);

// 🔌 WebSocket 처리
setupSocket(wss);

// ✅ 테스트용 엔드포인트
app.get("/", (req: Request, res: Response) => {
  res.send("🟢 Node 서버가 잘 실행되고 있어요!");
});

// ✅ 서버 실행
server.listen(PORT, () => {
  console.log(`🚀 Game Backend Server is running on http://localhost:${PORT}`);
});