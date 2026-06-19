import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

export function createSocket(token: string): Socket {
  return io(API_URL, {
    auth: { token }
  });
}
