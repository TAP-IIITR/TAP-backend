import jwt from "jsonwebtoken";
import { SERVER_CONFIG } from "../config/serverConfig";

interface JWTPayload {
  id: string;
  role: string;
}
if (!SERVER_CONFIG.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
if (!SERVER_CONFIG.JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN is not defined");
}
export const generateJWT = (payload: JWTPayload): string => {
  return jwt.sign(payload, String(SERVER_CONFIG.JWT_SECRET), {
    expiresIn: "7d",
  });
};

export const verifyJWT = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, String(SERVER_CONFIG.JWT_SECRET)) as JWTPayload;
  } catch (error) {
    throw new Error("Invalid token");
  }
};
