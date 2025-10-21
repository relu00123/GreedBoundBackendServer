
import net from "net";
import { PlayerManager } from "../../services/managers/PlayerManager";
import { FormatUtils } from "../../utils/formatUtils";
import { MatchQueueManager } from "../../services/managers/MatchQueueManager";
import { TEAMS_PER_MATCH_MAX } from "../../types/match";

function timeAgo(ms: number) {
  const d = Date.now() - ms;
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// 상수 객체를 만들고 밖에서 사용할 수 있도록 한다. 
export const ClientDebugHandlers : Record<string, (socket: net.Socket) => void> = {

    // 객체의 key, 즉 ClientDebugHandlers["show gamephase"]로 접근할 수 있도록 한다.
    // () => {...} : 화살표 함수.
    // 실제 실행할 핸들러 로직을 담고 있다. 
    "show gamephase": (socket) => {
        const pm = PlayerManager.getInstance("DebugConsole");
        const sessions = pm.GetAllPlayerSession();

        socket.write(`[GamePhase Status] Total: ${sessions.length}\r\n`);
        sessions.forEach((s, i) => {
            socket.write(
                `${FormatUtils.fixedWidthNumber(i + 1, 2)}. ` +
                `${FormatUtils.fixedWidthString(s.username, 10)} : ` +
                `${s.gamePhase}\r\n`
            );
        });
    },

    "show clients" : (socket) => {
         const pm = PlayerManager.getInstance("DebugConsole");
        const sessions = pm.GetAllPlayerSession();

        socket.write(`[Connected Clients] Total: ${sessions.length}\r\n`);
        sessions.forEach((s, i) => {
            socket.write(`  ${i + 1}. ${s.username}\r\n`);
        });
    },

    "show matching queues" : (socket) => {
        const mq = MatchQueueManager.getInstance();
        const snap = mq.getSnapshot();

        const mapIds = Object.keys(snap).map(Number).sort((a,b)=>a-b);
        if (mapIds.length === 0) {
        socket.write(`[Queues] No active maps.\r\n`);
        return;
        }

        for (const mapId of mapIds) {
            const s = snap[mapId];
            const partialCnt = s.partialTeams.length;
            const readyCnt = s.readyTeams.length;
            const currCnt = s.currentMatch ? s.currentMatch.teams.length : 0;

            const totalPlayers =
                s.partialTeams.reduce((acc, t) => acc + t.members.length, 0) +
                s.readyTeams.reduce((acc, t) => acc + t.members.length, 0) +
                (s.currentMatch ? s.currentMatch.teams.reduce((acc, t) => acc + t.members.length, 0) : 0);

            socket.write(
                `\r\n[Map ${mapId}] players=${totalPlayers} | partialTeams=${partialCnt} | readyTeams=${readyCnt} | currentMatch=${currCnt}/${TEAMS_PER_MATCH_MAX}\r\n`
            );

            if (s.currentMatch) {
                socket.write(`  - currentMatch (age ${timeAgo(s.currentMatch.createdAt)}):\r\n`);
                s.currentMatch.teams.forEach((t, i) => {
                socket.write(`      * T${i + 1} ${t.teamId} members=${t.members.length} [${t.members.join(", ")}]\r\n`);
                });
            }

            if (readyCnt > 0) {
                socket.write(`  - readyTeams:\r\n`);
                s.readyTeams.forEach((t, i) => {
                socket.write(`      * ${i + 1}. ${t.teamId} members=${t.members.length} age=${timeAgo(t.createdAt)}\r\n`);
                });
            }

            if (partialCnt > 0) {
                socket.write(`  - partialTeams (FIFO):\r\n`);
                s.partialTeams.forEach((p, i) => {
                socket.write(
                    `      * ${i + 1}. ${p.teamId} members=${p.members.length} remaining=${p.remaining} age=${timeAgo(p.createdAt)}\r\n`
                );
                });
            }
        }
        socket.write(`\r\n`);
    },
};