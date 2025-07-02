const { spawn } = require("child_process");
let portCounter = 8000;

function launchDungeonServer(dungeonId) {
  const port = portCounter++;

  const serverProcess = spawn(
    "path/to/YourGameServer.exe", // Unreal에서 빌드된 DedicatedServer 실행 파일
    [`YourMap?listen`, `-port=${port}`],
    {
      cwd: "path/to/folder", // 실행 디렉토리
      detached: true,
      stdio: "ignore", // 필요시 "inherit"으로 로그 확인 가능
    }
  );

  serverProcess.unref(); // 백그라운드로 실행

  console.log(`🚀 [DedicatedServer] ${dungeonId} 포트 ${port}에서 실행됨`);

  return port;
}

module.exports = {
  launchDungeonServer,
};