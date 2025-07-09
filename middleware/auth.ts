import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

// 사용자 정보를 확장한 커스텀 Request 타입
interface AuthenticatedRequest extends Request {
  user?: string | JwtPayload;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "토큰 없음" });

  jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
    if (err) return res.status(403).json({ message: "토큰 유효하지 않음" });
    req.user = user;
    next();
  });
}