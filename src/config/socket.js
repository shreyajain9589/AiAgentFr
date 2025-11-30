import { io } from "socket.io-client";

let socketInstance = null;

export const initializeSocket = (projectId) => {
  if (socketInstance) return socketInstance;

  socketInstance = io(import.meta.env.VITE_SOCKET_URL, {
    auth: {
      token: localStorage.getItem("token"),
    },
    query: {
      projectId,
    },
    transports: ["websocket", "polling"],
  });

  socketInstance.on("connect", () => {
    console.log("Socket connected:", socketInstance.id);
  });

  socketInstance.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  socketInstance.on("connect_error", (err) => {
    console.log("Socket connect error:", err.message);
  });

  return socketInstance;
};

export const sendMessage = (event, data) => {
  if (socketInstance) socketInstance.emit(event, data);
};

export const receiveMessage = (event, cb) => {
  if (socketInstance) socketInstance.on(event, cb);
};

export const getSocket = () => socketInstance;
