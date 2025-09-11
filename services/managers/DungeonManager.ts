// DungonManager.ts
import { DungeonSessionStore } from "../stores/DungeonSessionStore";
import { PortPool } from "../../utils/PortPool";
import type { DungeonStartResult, DungeonSession, DungeonId } from "../../types/dungeon";
import type { Match, MapId, UserId, MatchId} from "../../types/match";
import { genDungeonId, genDungeonAccessToken } from "../../utils/id";
import * as child_process from "child_process";
import * as net from "net";

type DungeonManagerConfig = {
  serverHost?: string;          // 예: "127.0.0.1"
  portRange?: [number, number]; // 예: [7700, 7799]
  tokenFactory?: (userId: UserId, matchId: MatchId) => string;
}

export class DungeonManager {
    private static _inst: DungeonManager | null = null;
    static getInstance() { return this._inst ?? (this._inst = new DungeonManager()); }

    private store = DungeonSessionStore.getInstance();
    private procs = new Map<DungeonId, child_process.ChildProcess>();

    private serverHost = process.env.DUNGEON_HOST || "127.0.0.1";
    private portPool = new PortPool(7700, 7799);
    private tokenFactory?: DungeonManagerConfig["tokenFactory"];

    private constructor() {}

    configure(cfg: DungeonManagerConfig) {
        if (cfg.serverHost) this.serverHost = cfg.serverHost;
        if (cfg.portRange)  this.portPool = new PortPool(cfg.portRange[0], cfg.portRange[1]);
        if (cfg.tokenFactory) this.tokenFactory = cfg.tokenFactory;
        return this;
    }

   /** MQM이 매치 발차 시 호출 */
    startMatch(match: Match): DungeonStartResult {
        const dungeonId: DungeonId = genDungeonId();
        const port = this.portPool.reserve();
        if (port == null) throw new Error("No free port for dungeon");
        const serverHost = this.serverHost;
        const serverAddr = `${serverHost}:${port}`;

        const { tokensByUser, teamIdByUser } = this.issueTokensAndTeamMap(match);

        const session: DungeonSession = {
        dungeonId,
        matchId: match.matchId,
        mapId: match.mapId,
        teams: match.teams,
        createdAt: Date.now(),
        status: "preparing",
        serverAddr,
        serverHost,
        serverPort: port,
        tokensByUser,
        teamIdByUser,
        };

        this.store.saveSession(session);

        this.spawnAndPrepare(session).catch((err) => {
            // 실패/타임아웃 시 세션 종료 + 포트 반납 + 프로세스 종료
            this.store.endSession(session.dungeonId, "aborted");
            if (typeof session.serverPort === "number") {
            this.portPool.release(session.serverPort);
            }
            const p = this.procs.get(session.dungeonId);
            if (p) { try { p.kill(); } catch {} }
            this.procs.delete(session.dungeonId);
            // 로그만 남김 (상위는 whenReady() 타임아웃으로 알림 보냄)
            console.warn(`[DungeonManager] prepare failed dng=${session.dungeonId} err=${String(err?.message || err)}`);
        });

        return { dungeonId, serverAddr, tokensByUser };
    }

    // 비동기 준비 루틴: 스폰 → 포트 리슨 대기 → running 마킹
    private async spawnAndPrepare(session: DungeonSession): Promise<void> {
        const child = this.spawnDungeonProcess(session);
        if (child) {
            this.procs.set(session.dungeonId, child);

            // (옵션) PID 기록해두고 싶으면 Store에 setter 추가해서 기록
            // this.store.setSessionPid(session.dungeonId, child.pid);

            // 프로세스 종료 훅: 상태/포트 정리
            child.on("exit", (code, signal) => {
            // 러닝 중 종료되면 세션도 종료로 마킹
            const s = this.store.getSessionByDungeonId(session.dungeonId);
            if (s && s.status !== "ended") {
                this.store.endSession(session.dungeonId, code === 0 ? "completed" : "crash");
                if (typeof s.serverPort === "number") this.portPool.release(s.serverPort);
            }
            this.procs.delete(session.dungeonId);
            });
        }

        // 서버가 실제로 리슨을 시작했는지 TCP로 폴링
        await this.waitUntilListening(session.serverHost!, session.serverPort!, 15_000, 100);

        // 준비 완료 → running 마킹 (MQM.whenReady()가 여기서 풀림)
        this.store.setSessionStatus(session.dungeonId, "running");
    }

    private spawnDungeonProcess(session: DungeonSession): child_process.ChildProcess | null {
        const cmd = process.env.DUNGEON_CMD; // 예: "/path/to/DedicatedServer"
        if (!cmd) {
            // 개발 편의: 외부 DS 없이도 whenReady()는 포트 리슨에 성공하면 진행됨
            // 실제 프로젝트에선 꼭 커맨드를 설정하세요.
            console.warn("[DungeonManager] DUNGEON_CMD not set. Skipping spawn (dev mode).");
            return null;
        }

        const env = {
            ...process.env,
            DUNGEON_ID: session.dungeonId,
            MATCH_ID: session.matchId,
            MAP_ID: String(session.mapId),
            PORT: String(session.serverPort),
            HOST: session.serverHost || "127.0.0.1",
        };

        // 필요 시 args 추가
        const args: string[] = []; // ex) ["-log", `-port=${session.serverPort}`]
        const child = child_process.spawn(cmd, args, {
            env,
            stdio: "inherit", // 서버 로그를 콘솔에 바로 출력
            shell: process.platform === "win32", // 윈도우 호환
        });

        return child;
    }

    // TCP 포트 리슨 체크 (연결 성공 = 준비 ok)
    private waitUntilListening(
        host: string,
        port: number,
        timeoutMs = 15000,
        intervalMs = 100
        ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const deadline = Date.now() + timeoutMs;

            const attempt = () => {
            const socket = net.connect({ host, port });
            let settled = false;

            const done = (ok: boolean) => {
                if (settled) return;
                settled = true;
                socket.removeAllListeners();
                socket.destroy();
                if (ok) resolve();
                else {
                if (Date.now() >= deadline) reject(new Error("DUNGEON_READY_TIMEOUT"));
                else setTimeout(attempt, intervalMs);
                }
            };

            socket.once("connect", () => done(true));
            socket.once("error", () => done(false));
            // 안전 타임아웃 (간혹 즉시 에러 안 나오는 경우 대비)
            setTimeout(() => done(false), Math.min(intervalMs * 2, 1000));
            };

            attempt();
        });
    }

    /** 매치 종료 시 포트 반납 헬퍼 */
    endDungeonSessionByMatchId(matchId: MatchId, reason?: DungeonSession["endReason"]): boolean {
        const s = this.store.getSessionByMatchId(matchId);
        if (!s) return false;

        const ended = this.store.endSession(s.dungeonId, reason);
        if (ended && typeof s.serverPort === "number") {
            this.portPool.release(s.serverPort);
        }
        return ended;
    }



    endDungeonSession(dungeonId: DungeonId, reason?: DungeonSession["endReason"]): boolean {
        const s = this.store.getSessionByDungeonId(dungeonId);
        if (!s) return false;

        const ended = this.store.endSession(dungeonId, reason);
        if (ended && typeof s.serverPort === "number") {
            this.portPool.release(s.serverPort);
        }
        return ended;
    }

    private issueTokensAndTeamMap(match: Match) {
        const tokensByUser: Record<UserId, string> = {};
        const teamIdByUser: Record<UserId, string> = {};
        for (const team of match.teams) {
        for (const username of team.members) {
            teamIdByUser[username] = team.teamId;
            tokensByUser[username] = this.tokenFactory
            ? this.tokenFactory(username, match.matchId as MatchId)
            : genDungeonAccessToken();
        }
        }
        return { tokensByUser, teamIdByUser };
    }

    verifyUserToken(
        dungeonId: DungeonId,
        userId: UserId,
        token: string,
        consume = true
    ) 
    {
        return this.store.verifyUserToken(dungeonId, userId, token, { consume });
    }

    async whenReady(dungeonId: DungeonId, timeoutMs = 15000, pollMs = 100): Promise<DungeonSession> {
        const t0 = Date.now();
        for (;;) {
            const s = this.store.getSessionByDungeonId(dungeonId);
            if (!s) throw new Error("DUNGEON_GONE");
            if (s.status === "running") return s;
            if (Date.now() - t0 >= timeoutMs) throw new Error("DUNGEON_READY_TIMEOUT");
            await new Promise(r => setTimeout(r, pollMs));
        }
    }
}