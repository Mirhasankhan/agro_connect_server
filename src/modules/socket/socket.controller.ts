import { Controller, Get, Req } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { SocketPresenceService } from "./socket.presence.service";

@Controller("conversations")
export class SocketController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly presence: SocketPresenceService,
    ) {}

    @Get()
    async getConversations(@Req() request: Request) {
        const userId = (request.user as { id: string }).id;
        const conversations = await this.prisma.conversation.findMany({
            where: {
                OR: [{ participantA: userId }, { participantB: userId }],
            },
            orderBy: { updatedAt: "desc" },
            include: {
                participantAUser: {
                    select: {    
                        id:true,               
                        fullName: true,
                        profileImage: true,                  
                    },
                },
                participantBUser: {
                    select: {
                        id:true,
                        fullName: true,
                        profileImage: true,                     
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        message: true,
                        images: true,
                        createdAt: true,
                    },
                },
            },
        });

        return Promise.all(conversations.map(async (conversation) => {
            const participant =
                conversation.participantA === userId
                    ? conversation.participantBUser
                    : conversation.participantAUser;
            const unreadCount = await this.prisma.chatMessage.count({
                where: {
                    conversationId: conversation.id,
                    receiverId: userId,
                    isRead: false,
                },
            });

            return {
                participant: {
                    ...participant,
                    isOnline: this.presence.isOnline(
                        conversation.participantA === userId
                            ? conversation.participantB
                            : conversation.participantA,
                    ),
                },
                lastMessage: conversation.messages[0] || null,
                unreadCount,
            };
        }));
    }
}
