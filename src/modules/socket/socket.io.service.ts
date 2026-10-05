import { PrismaService } from "@/core/services/prisma/prisma.service";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import { UserRole } from "@prisma/client";
import { Server, Socket } from "socket.io";
import config from "@/config";
import { SocketPresenceService } from "./socket.presence.service";

type SubscribePayload = {
    userId: string;
};

type MessagePayload = {
    receiverId: string;
    message: string;
    images?: string[];
};

@WebSocketGateway({
    cors: { origin: "*", methods: ["GET", "POST"] },
    perMessageDeflate: false,
})
export class WebsocketGateway
    implements OnGatewayConnection, OnGatewayDisconnect
{
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WebsocketGateway.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly presence: SocketPresenceService,
    ) {}

   
    async handleConnection(socket: Socket) {
        try {
            const token = this.extractToken(socket);
            if (!token) throw new Error("No token provided");

            const payload = await this.jwtService.verifyAsync(token, {
                secret:
                    this.configService.get<string>("JWT_SECRET") ||
                    config.jwt.jwt_secret,
            });

            // Support the most common JWT id claim names
            const userId = (payload.id ?? payload.userId ?? payload.sub) as
                | string
                | undefined;
            if (!userId) throw new Error("Token has no user id claim");

            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, deleted: true },
            });

            if (!user || user.deleted) throw new Error("Invalid user");

            socket.data.userId = userId;
            this.presence.add(userId, socket.id);

            socket.emit("authenticated", { userId, message: "Authenticated" });
        } catch (err) {
            this.logger.warn(
                `Socket ${socket.id} auth failed: ${(err as Error).message}`,
            );
            this.emitError(socket, "Authentication failed");
            socket.disconnect(true);
        }
    }

    handleDisconnect(socket: Socket) {
        const userId = socket.data.userId as string | undefined;
        if (!userId) return;

        this.presence.remove(userId, socket.id);
    }

  
    @SubscribeMessage("subscribe")
    async subscribe(
        @MessageBody() rawPayload: unknown,
        @ConnectedSocket() socket: Socket,
    ) {
        try {
            const userId = socket.data.userId as string | undefined;
            if (!userId) {
                return this.emitError(socket, "Not authenticated");
            }

            const payload = this.parsePayload<SubscribePayload>(rawPayload);
            if (!payload.userId || userId === payload.userId) {
                return this.emitError(
                    socket,
                    "A valid conversation user is required",
                );
            }

            const conversation = await this.getOrCreateConversation(
                userId,
                payload.userId,
            );
            const room = this.roomName(conversation.id);
            await socket.join(room);

            await this.prisma.chatMessage.updateMany({
                where: {
                    conversationId: conversation.id,
                    receiverId: userId,
                    isRead: false,
                },
                data: { isRead: true },
            });

            const messages = await this.prisma.chatMessage.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "asc" },
                select: {
                    message: true,
                    images: true,
                    isRead: true,
                    createdAt: true,
                    senderId: true,
                },
            });

            const participant = await this.prisma.user.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    fullName: true,
                    role: true,
                    profileImage: true,
                },
            });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { participantA, participantB, ...conversationDetails } =
                conversation;

            socket.emit("conversationHistory", {
                conversation: {
                    ...conversationDetails,
                    participant: participant
                        ? {
                              ...participant,
                              isOnline: this.presence.isOnline(
                                  participant.id,
                              ),
                          }
                        : null,
                },
                messages: messages.map(({ senderId, ...message }) => ({
                    ...message,
                    isSendByMe: senderId === userId,
                })),
            });
        } catch (err) {
            this.handleError(socket, err, "subscribe");
        }
    }

    @SubscribeMessage("sendMessage")
    async sendMessage(
        @MessageBody() rawPayload: unknown,
        @ConnectedSocket() socket: Socket,
    ) {
        try {
            const senderId = socket.data.userId as string | undefined;
            if (!senderId) {
                return this.emitError(socket, "Not authenticated");
            }

            const payload = this.parsePayload<MessagePayload>(rawPayload);
            if (!payload.receiverId || !payload.message?.trim()) {
                return this.emitError(socket, "Receiver and message are required");
            }

            const conversation = await this.getOrCreateConversation(
                senderId,
                payload.receiverId,
            );
            const room = this.roomName(conversation.id);
            if (!socket.rooms.has(room)) {
                return this.emitError(socket, "Subscribe to the conversation first");
            }

            const savedMessage = await this.prisma.chatMessage.create({
                data: {
                    conversationId: conversation.id,
                    senderId,
                    receiverId: payload.receiverId,
                    message: payload.message.trim(),
                    images: Array.isArray(payload.images) ? payload.images : [],
                },
            });

            await this.prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() },
            });

            const sockets = await this.server.in(room).fetchSockets();
            for (const targetSocket of sockets) {
                const { senderId, ...message } = savedMessage;
                targetSocket.emit("message", {
                    ...message,
                    isSendByMe: senderId === targetSocket.data.userId,
                });
            }
        } catch (err) {
            this.handleError(socket, err, "sendMessage");
        }
    }


    private extractToken(socket: Socket): string | null {
        const { auth, query, headers } = socket.handshake;

        const raw =
            auth?.token ??
            query?.token ??
            headers?.token ??
            headers?.authorization;

        const value = Array.isArray(raw) ? raw[0] : raw;
        if (!value) return null;

        const token = String(value)
            .trim()
            .replace(/^Bearer\s+/i, "");
        return token || null;
    }

   
    private parsePayload<T>(payload: unknown): Partial<T> {
        if (typeof payload === "string") {
            try {
                const parsed = JSON.parse(payload);
                return parsed && typeof parsed === "object"
                    ? (parsed as Partial<T>)
                    : {};
            } catch {
                return {};
            }
        }
        return payload && typeof payload === "object"
            ? (payload as Partial<T>)
            : {};
    }

    private async getOrCreateConversation(userId: string, otherUserId: string) {
        const [participantA, participantB] = [userId, otherUserId].sort();

        const [otherUser, currentUser] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: otherUserId },
                select: { id: true, role: true, deleted: true },
            }),
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true },
            }),
        ]);

        if (
            !otherUser ||
            otherUser.deleted ||
            !this.isAllowedConversation(otherUser.role)
        ) {
            throw new Error("User is not available for messaging");
        }

        if (
            !currentUser ||
            !this.isAllowedConversationPair(currentUser.role, otherUser.role)
        ) {
            throw new Error(
                "Only buyer-producer and buyer-driver conversations are allowed",
            );
        }

        return this.prisma.conversation.upsert({
            where: { participantA_participantB: { participantA, participantB } },
            create: { participantA, participantB },
            update: {},
        });
    }

    private isAllowedConversation(role: UserRole) {
        return (
            role === UserRole.BUYER ||
            role === UserRole.PRODUCER ||
            role === UserRole.DRIVER
        );
    }

    private isAllowedConversationPair(first: UserRole, second: UserRole) {
        return (
            (first === UserRole.BUYER &&
                (second === UserRole.PRODUCER || second === UserRole.DRIVER)) ||
            (second === UserRole.BUYER &&
                (first === UserRole.PRODUCER || first === UserRole.DRIVER))
        );
    }

    private roomName(conversationId: string) {
        return `conversation:${conversationId}`;
    }

    private handleError(socket: Socket, err: unknown, event: string) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        this.logger.error(`${event} failed for socket ${socket.id}: ${message}`);
        this.emitError(socket, message);
    }

    private emitError(socket: Socket, message: string) {
        socket.emit("error", { message });
    }
}