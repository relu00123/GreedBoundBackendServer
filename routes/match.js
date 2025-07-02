// routes/match.js

const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getSession } = require("../services/sessionStore");
const PlayerState = require("../constants/playerstate");
const { addToMatchQueue } = require("../services/matchManager");

// 클라 -> 서버로 게임시작을 하고 싶을때 사용하는 라우터 
router.post("/start", authenticateToken, (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ success: false, message: "세션이 존재하지 않습니다." });
  }

  const username = session.username;

  if ([PlayerState.MATCHING, PlayerState.GAME].includes(session.state)) {
    return res.status(400).send("이미 매칭 중이거나 게임 중입니다.");
  }

  addToMatchQueue(username, token);

  return res.status(200).send({ message: "매칭 시작됨" });
});


// 플레이어 한명의 match status를 반환해주는 라우터 
router.get("/status", authenticateToken, (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const session = getSession(token)

  if(!session) return res.status(401).json({success: false});

  if (session.state === PlayerState.game.GAME) {
    return res.json({
      matched:true,
      port: session.port,
      dungeonId: session.dungeonId
    });
  }

  return res.json({ matched:false});
});



module.exports = router;