import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string;
  telegramId: string;
};

export function signAuthToken(payload: JwtPayload, secret: string) {
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret);

  if (!decoded || typeof decoded !== "object" || !("sub" in decoded) || !("telegramId" in decoded)) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: String(decoded.sub),
    telegramId: String(decoded.telegramId)
  };
}
