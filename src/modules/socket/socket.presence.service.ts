import { Injectable } from "@nestjs/common";

@Injectable()
export class SocketPresenceService {
    private readonly userSockets = new Map<string, Set<string>>();

    add(userId: string, socketId: string) {
        const sockets = this.userSockets.get(userId) || new Set<string>();
        sockets.add(socketId);
        this.userSockets.set(userId, sockets);
    }

    remove(userId: string, socketId: string) {
        const sockets = this.userSockets.get(userId);
        if (!sockets) return;

        sockets.delete(socketId);
        if (sockets.size === 0) this.userSockets.delete(userId);
    }

    isOnline(userId: string) {
        return (this.userSockets.get(userId)?.size || 0) > 0;
    }
}
