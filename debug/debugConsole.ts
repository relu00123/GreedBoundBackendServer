import net from "net";
import { DebugCommands } from "./debugCommand";



// TCP/콘솔 입력을 받고 명령을 실행하는 역할
export function startDebugConsole(port: number = 4000) {

    // net은 Node.js 표준 라이브러리 중 하나로, TCP 서버를 만들 때 쓰인다.
    // CreateServer 함수에 콜백 함수를 넣어주면, 클라이언트가 서버에 연결될 때마다 이 콜백이 실행된다.
    // 이때 콜백의 매개변수로 들어오는 것이 Socket

    // 1. 서버 시작 (net.CreateServer((socket) -> {...}))
    //   - 여기서 서버가 클라이언트 접속 이벤트를 기다린다.
    // 2. 접속이 발생하면 Node.js가 net.Socket 객체를 만들어서
    //   - 우리가 등록한 콜백함수의 socket인자에 넣어준다.
    // 3. 이제 Socket을 통해 통신이 가능하다. 
    const server = net.createServer((socket) => {
        socket.write("Admin console connected. Type 'help'\r\n> ");

       let buffer = ""; // 입력 누적 버퍼

        socket.on("data", (data) => {
            buffer += data.toString();

            // 개행(\n, \r\n) 단위로 처리
            if (buffer.includes("\r\n")) {
                const input = buffer.trim();
                buffer = ""; // 버퍼 초기화

                const cmd = DebugCommands[input];
                if (cmd) {
                    cmd(socket);
                } else {
                    socket.write(`Unknown Command : ${input}\r\n`);
                }

                socket.write("\r\n> "); // 프롬프트 다시 표시
            }
        });
    });

    server.listen(port, () => {
        console.log(`Debug console on port ${port}`);
    });

}
