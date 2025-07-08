import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserService } from '../users/user.service';
export type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void;
export declare class WsAuthMiddleware {
    private readonly jwtService;
    private readonly userService;
    constructor(jwtService: JwtService, userService: UserService);
    createMiddleware(): SocketMiddleware;
}
