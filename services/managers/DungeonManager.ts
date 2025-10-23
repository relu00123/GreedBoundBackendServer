// DungonManager.ts
import { DungeonSessionStore } from "../stores/DungeonSessionStore";
import { PortPool } from "../../utils/PortPool";
import type { DungeonStartResult, DungeonSession, DungeonId } from "../../types/dungeon";
import type { Match, MapId, UserId, MatchId} from "../../types/match";
import { TeamId } from "../../types/match";
import { JoinCredentialsByUser } from "../../types/network";
import { genDungeonId, genDungeonAccessToken } from "../../utils/id";
import { getUEMapPath } from "../../constants/GameMapCatalog";
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
    // 세션을 만들고 포트를 할당한다.
    startMatch(match: Match): DungeonStartResult {
        const dungeonId: DungeonId = genDungeonId();

        // 1) 포트/주소 할당
        const port = this.portPool.reserve();
        if (port == null) throw new Error("No free port for dungeon");
        const serverHost = this.serverHost;              // 외부 접속 가능한 호스트(도메인/IP)
        const serverAddrStr = `${serverHost}:${port}`;   // 세션에는 문자열로도 보관
        const serverAddr = { host: serverHost, port };   // 호출부/브로드캐스트에는 객체로 전달

        // 2) 기존 로직: 유저별 토큰과 팀ID 매핑 생성
        //    (이 함수는 네 프로젝트에 이미 있음)
        const { tokensByUser, teamIdByUser } = this.issueTokensAndTeamMap(match);

        // 3) 팀ID → 팀인원 수 매핑을 만들고,
        //    tokensByUser + teamIdByUser를 합쳐 유저별 접속 자격(joinCredsByUser) 생성
        const teamSizeByTeamId: Record<TeamId, number> = {};
        for (const t of match.teams) {
            teamSizeByTeamId[t.teamId as TeamId] = t.members.length;
        }

        const joinCredsByUser: JoinCredentialsByUser = {};
        for (const [userId, joinToken] of Object.entries(tokensByUser)) {
            const teamId = teamIdByUser[userId as UserId] as TeamId;
            const teamSize = teamSizeByTeamId[teamId] ?? 1;
            joinCredsByUser[userId as UserId] = { joinToken, teamId, teamSize };
        }

        // 4) 세션 저장 (기존 필드는 그대로 유지)
        const session: DungeonSession = {
            dungeonId,
            matchId: match.matchId,
            mapId: match.mapId,
            teams: match.teams,
            createdAt: Date.now(),
            status: "preparing",
            serverAddr: serverAddrStr, // 문자열 필드 유지
            serverHost,
            serverPort: port,
            tokensByUser,              // ← 기존 verifyUserToken 등에서 사용
            teamIdByUser,
        };
        this.store.saveSession(session);

        // 5) DS 스폰/준비 (실패 시 정리)
        this.spawnAndPrepare(session).catch((err) => {
            this.store.endSession(session.dungeonId, "aborted");
            if (typeof session.serverPort === "number") {
            this.portPool.release(session.serverPort);
            }
            const p = this.procs.get(session.dungeonId);
            if (p) { try { p.kill(); } catch {} }
            this.procs.delete(session.dungeonId);

            console.warn(
            `[DungeonManager] prepare failed dng=${session.dungeonId} err=${String(err?.message || err)}`
            );
        });

        // 6) 호출자에 반환: dungeonId, {host,port}, 유저별 접속 자격
        return { dungeonId, serverAddr, joinCredsByUser };
    }

    // 비동기 준비 루틴: 스폰 → 포트 리슨 대기 → running 마킹
    private async spawnAndPrepare(session: DungeonSession): Promise<void> {
        const child = this.spawnDungeonProcess(session);
        if (child) {
            this.procs.set(session.dungeonId, child);

            // (옵션) PID 기록이 필요하면 사용
            // this.store.setSessionPid(session.dungeonId, child.pid);

            // 프로세스 종료 훅: 상태/포트 정리
            child.on("exit", (code) => {
            const s = this.store.getSessionByDungeonId(session.dungeonId);
            if (s && s.status !== "ended") {
                this.store.endSession(session.dungeonId, code === 0 ? "completed" : "crash");
                if (typeof s.serverPort === "number") this.portPool.release(s.serverPort);
            }
            this.procs.delete(session.dungeonId);
            });
        }

        // ⛔ 기존: TCP로 포트 리슨 대기 (UE는 UDP → 항상 실패 가능) 제거
        // await this.waitUntilListening(...);

        // ⛔ 기존: 여기서 running 마킹 제거
        // 준비 완료 마킹은 /dungeonReady 라우터에서만 수행:
        // store.setSessionStatus(dungeonId, "running");
    }

    private mapPathFromId(mapId: MapId): string {
        // 운영에서는 getUEMapPath 사용(오류 발생 시 즉시 중단)
        // 개발/테스트 모드에서는 Safe 버전도 고려 가능
        return getUEMapPath(mapId);
    }

    // Dungeon Instance를 생성한다. 
    // Dedicated Server에서는 맵 로딩/리스닝이 끝나서 Client들을 접속 받아도 되는 상태가 되면
    // -redayUrl로 HTTP통신을 보낸다. (routes/dungeon의 dungeonReady로 post)
   private spawnDungeonProcess(session: DungeonSession): child_process.ChildProcess | null {
        const cmd = process.env.DUNGEON_CMD; // 예: "C:\\Path\\To\\UnrealEditor-Cmd.exe" 또는 패키지드 DS 바이너리
        if (!cmd) {
            console.warn("[DungeonManager] DUNGEON_CMD not set. Skipping spawn (dev mode).");
            return null;
        }

        const readyUrl    = process.env.DS_READY_URL   || "http://127.0.0.1:3000/dungeon/dungeonReady";
        const readySecret = process.env.DS_READY_SECRET || "";

        // spawn의 args는 배열이라 경로에 공백이 있어도 따옴표가 필요 없습니다.
        const uproject = "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound\\Greedbound.uproject";
        //const uproject = "C:\\Users\\relu0\\Desktop\\GreedboundSVN\\Greedbound\\Greedbound.uproject";
        const mapPath  = this.mapPathFromId(session.mapId);

        const args = [
            uproject,
            "-server", "-game", "-log", "-nosteam",
            mapPath,
            `-port=${session.serverPort}`,
            `-dungeonid=${session.dungeonId}`,
            `-matchid=${session.matchId}`,
            `-readyUrl=${readyUrl}`,
            `-host=${session.serverHost || "127.0.0.1"}`, 
        ];

        console.log("[DM] spawn:", cmd, args.join(" "));

        if (readySecret) args.push(`-readySecret=${readySecret}`);

        // ⬇︎ 여기서 만든 env를 실제로 넘겨야 한다.
        const env = {
            ...process.env,
            DUNGEON_ID: session.dungeonId,
            MATCH_ID:   session.matchId,
            MAP_ID:     String(session.mapId),
            PORT:       String(session.serverPort),
            HOST:       session.serverHost || "127.0.0.1",
        };

        const child = child_process.spawn(cmd, args, {
            stdio: "inherit",
            shell: false,   // .bat/.cmd 실행이 필요한 경우에만 true로 바꾸세요.
            env,            // ✅ process.env 대신 우리가 만든 env 사용
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
                let guardTimer: NodeJS.Timeout | null = null;

                const cleanup = () => {
                    if (guardTimer) { clearTimeout(guardTimer); guardTimer = null; }
                    socket.removeAllListeners();
                    socket.destroy();
                };

                const done = (ok: boolean) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    if (ok) {
                    resolve();
                    } else {
                    if (Date.now() >= deadline) reject(new Error("DUNGEON_READY_TIMEOUT"));
                    else setTimeout(attempt, intervalMs);
                    }
                };

                socket.once("connect", () => done(true));
                socket.once("error", () => done(false));
                // 안전 타임아웃 (간혹 즉시 에러 안 나오는 경우 대비)
                guardTimer = setTimeout(() => done(false), Math.min(intervalMs * 2, 1000));
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

    

    // Dungeon Instance의 준비완료를 기다린다. 
    // dungeon Instance의 상태 변경을 감지해서 promise resolve -> MQM (MatchQueueManager)가 그 시점에
    // DungeonReady 메세지를 소캣으로 전송한다.
    // 이때 서버주소, 서버에 입장하기위한 Unique 한 토큰들이 포함된다. 
    async whenReady(dungeonId: DungeonId, timeoutMs = 100000, pollMs = 100): Promise<DungeonSession> {
        const t0 = Date.now();

        // For문을 돌면서 DS가 정말 실행 준비 완료상태인지 기다리는 루프이다. 
        for (;;) {
            const s = this.store.getSessionByDungeonId(dungeonId);
            if (!s) throw new Error("DUNGEON_GONE");
            if (s.status === "running") return s;
            if (Date.now() - t0 >= timeoutMs) throw new Error("DUNGEON_READY_TIMEOUT");
            await new Promise(r => setTimeout(r, pollMs));
        }
    }

    
}