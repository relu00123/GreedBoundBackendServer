
import net from "net";
import { PlayerManager } from "../../services/managers/PlayerManager";
import { FormatUtils } from "../../utils/formatUtils";

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
};