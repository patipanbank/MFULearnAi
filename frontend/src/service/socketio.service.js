import { io } from 'socket.io-client';
class SocketioService {
    socket;
    constructor() {}

    setupSocketConnection() {
        this.socket = io("ws://127.0.0.1:80");
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }


// io.on('connection', (socket) => {
//     console.log('a user connected');
//
//     socket.on('disconnect', () => {
//         console.log('user disconnected');
//     });
//
//     socket.on('my message', (msg) => {
//         console.log('message: ' + msg);
//     });
// });

}



export default new SocketioService();
