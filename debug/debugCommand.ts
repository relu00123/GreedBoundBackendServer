import net from "net";
import { ClientDebugHandlers } from "./handlers/ClientDebugHandlers";

// 명령어 -> 실행 함수 매핑
export const DebugCommands : Record<string, (socket: net.Socket) => void>  = {

    ...ClientDebugHandlers,
    
    help: (socket) => {
        const commands = Object.keys(DebugCommands);

        socket.write("Available Commands:\r\n");
        commands.forEach((cmd, i) => {
            socket.write(`  ${i + 1}. ${cmd}\r\n`);
        });
    }
}