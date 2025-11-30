import { io } from 'socket.io-client';

let socketInstance = null;

export const initializeSocket = (projectId) => {
    // If socket already exists, optionally join new project (depends on server impl)
    if (socketInstance) {
        // re-initialize join if needed by reconnecting with query
        socketInstance.disconnect();
        socketInstance = null;
    }

    socketInstance = io(import.meta.env.VITE_SOCKET_URL, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        },
        transports: ['websocket', 'polling'],
        autoConnect: true,
    });

    socketInstance.on('connect_error', (err) => {
        console.log('Socket connect error:', err.message);
    });

    socketInstance.on('connect', () => {
        console.log('Socket connected', socketInstance.id);
    });

    socketInstance.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
    });

    return socketInstance;
}

export const receiveMessage = (eventName, cb) => {
    if (socketInstance) socketInstance.on(eventName, cb);
}

export const sendMessage = (eventName, data) => {
    if (socketInstance) socketInstance.emit(eventName, data);
}

export const getSocket = () => socketInstance;
