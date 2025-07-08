const { spawn } = require("child_process");
const crypto = require("crypto");
let portCounter = 8000;

function generateDungeonToken() {
  return crypto.randomBytes(16).toString("hex");
}

function launchDungeonServer(dungeonId) {
  const port = portCounter++;
  const token = generateDungeonToken();

  // Batch 파일 경로
  const batPath = "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound\\BatchFile\\LaunchDungeonServer.bat";

  const serverProcess = spawn("cmd.exe", ["/c", batPath, token, dungeonId.toString(), port.toString()], {
    cwd: "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound", // bat 파일 위치 (선택 사항)
    detached: true,
    stdio: "ignore", // or "inherit" to see logs
  });

  serverProcess.unref(); // 백그라운드 실행

  console.log(`🚀 [EditorServer] Dungeon_${dungeonId} 포트 ${port}에서 실행됨`);
  return {token, port};
}

module.exports = {
  launchDungeonServer,
};


