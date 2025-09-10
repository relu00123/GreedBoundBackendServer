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

import { MatchQueueManager } from "./services/managers/MatchQueueManager";
import { PlayerManager } from "./services/managers/PlayerManager";
import { PartyManager } from "./services/managers/PartyManager";
import { DungeonManager } from "./services/managers/DungeonManager";

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

// 매칭 서브시스템 초기화 (+ 에이징 타이머)
let agingTimer: NodeJS.Timeout | null = null;

function initializeMatchQueue() {
  const mqm = MatchQueueManager.getInstance()
    // Dependency Injection 부분 skip 
    // .attachPlayerManager(PlayerManager.getInstance("index.ts"))
    // .attachPartyManager(PartyManager.getInstance())
    // .attachDungeonManager(DungeonManager.getInstance())
    // 에이징이 필요 없다면 configureAging 호출을 빼도 됩니다
    .configureAging({ maxWaitMs: 30_000, minTeamsToLaunch: 2 });

  // 1초 간격으로 에이징 틱
  agingTimer = setInterval(() => mqm.tickAging(), 1_000);

  return mqm;
}

// 그레이스풀 종료 (서버 종료시 깔끔하게 종료할 수 있도록)
function setupGracefulShutdown() {
  const cleanup = () => {
    if (agingTimer) clearInterval(agingTimer);
    try { wss.close(); } catch {}
    try { server.close(() => process.exit(0)); } catch { process.exit(0); }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  server.on("close", () => {
    if (agingTimer) clearInterval(agingTimer);
  });
}

// 🟢 서버 시작 함수
async function startServer() {
  try {
    console.log("📦 Running DB migrations...");
    await runAllMigrations();  // ✅ 여기서 완료 보장
    console.log("✅ DB migrations complete.");

    // 매칭 시스템 초기화
    initializeMatchQueue();
    setupGracefulShutdown();

    server.listen(PORT, () => {
      console.log(`🚀 Game Backend Server is running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ 서버 시작 중 오류 발생:", error);
    process.exit(1);
  }
}

startServer(); // 🧠 async 함수 실행