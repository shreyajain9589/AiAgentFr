import { io } from 'socket.io-client';

let socketInstance = null;

export const initializeSocket = (projectId) => {
    socketInstance = io('http://localhost:5000', { // <- make sure port 5000
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        },
        transports: ['websocket', 'polling'] // make polling fallback
    });

    socketInstance.on('connect_error', (err) => {
        console.log('Socket connect error:', err.message);
    });

    return socketInstance;
}

export const receiveMessage = (eventName, cb) => {
    if (socketInstance) socketInstance.on(eventName, cb);
}

export const sendMessage = (eventName, data) => {
    if (socketInstance) socketInstance.emit(eventName, data);
}
