import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import http from "http";
import WebSocket from "ws";

import authRoutes from "./routes/auth";
import matchRoutes from "./routes/match";
//import playerRoutes from "./routes/player";

import { setupSocket } from "./ws/SetupSocket";
import { runAllMigrations } from "./migration/runAllMigrations";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/", authRoutes);
app.use("/match", matchRoutes);
//app.use("/players", playerRoutes);

setupSocket(wss);

// 🟢 서버 시작 함수
async function startServer() {
  try {
    console.log("📦 Running DB migrations...");
    await runAllMigrations();  // ✅ 여기서 완료 보장
    console.log("✅ DB migrations complete.");

    server.listen(PORT, () => {
      console.log(`🚀 Game Backend Server is running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ 서버 시작 중 오류 발생:", error);
    process.exit(1);
  }
}

startServer(); // 🧠 async 함수 실행