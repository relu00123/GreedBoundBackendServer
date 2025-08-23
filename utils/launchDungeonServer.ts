import {spawn } from "child_process"
import * as crypto from "crypto"
import { MapType } from "../types/dungeon";
import { SERVER_CONFIG } from "../config/constants";

let portCounter = 8000;

// 던전 토큰 생성 
function generateDungeonToken() {
  return crypto.randomBytes(16).toString("hex");
}

// 던저 서버 실행
// DedicatedServer를 만들고 token과 port를 반환한다. 
export function launchDungeonServer(mapType: MapType, instanceNumber : number) : { generatedDungeonToken : string ; generatedDungeonPort : number; } 
{
    const generatedDungeonInstanceName = `${mapType}_${instanceNumber}`;
    const generatedDungeonToken = generateDungeonToken();
    const generatedDungeonPort = portCounter++;

    // 나중에 이쪽부분 config 파일의 constant에서 온전히 가져와야함.. 
    const createdDedicatedServerInstance = spawn("cmd.exe", ["/c", SERVER_CONFIG.batFilePath, generatedDungeonInstanceName, 
        generatedDungeonPort.toString(), generatedDungeonToken], {
        // 이 옵션들에대해서는 잘 알지 못함.. GPT가 적어둔 것을 가져왔음. 
        // cwd : 지금 생성하려고하는 프로세스가 어느 디렉토리에서 실행될지를 지정하는 옵션. 생략시에는 Node.js가 실행중인 디렉토리를 기준으로 bat를 실행 
        cwd : SERVER_CONFIG.batFileDir, 
        // 자식 프로세스를 부모와 독립적으로 실행시킨다. 
        detached : true,
        // 부모-자식 프로세스 간의 표준 입력/출력 연결 방식을 설정
        // inherit : 부모의 콘솔 I/O를 그대로 사용 
        // ignore : 자식 프로세스의 stdin, stdout, stderr를 무시 (콘솔에 출력 안됨)
        // pipe : 부모가 자식의 stdout/stderr를 프로그래밍적으로 읽을 수 있게함 
        stdio : "inherit"
    });

    // Node.js의 이벤트 루프가 이 프로세스를 기다리지 않도록 만드는 함수라고 한다.
    // 아래의 함수를 호출하면 자식 프로세스가 살아 있어도, Node.js는 이를 무시하고 종료할 수 있다고 한다. 
    createdDedicatedServerInstance.unref();

    console.log(`🚀 [launchDungeonServer] ${generatedDungeonInstanceName}가 포트 ${generatedDungeonPort}에서 실행되었습니다!`);
    
    return { generatedDungeonToken, generatedDungeonPort };
}

 
