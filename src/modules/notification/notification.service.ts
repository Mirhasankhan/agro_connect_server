import { PrismaService } from "@/core/services/prisma/prisma.service";
import { TNotificationType } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { UserPayload } from "@/common/guards/auth.guard";

export interface CreateNotificationInput {
    receiverId: string;
    title: string;
    content: string;
    notificationType: TNotificationType;
}

@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService) {}

    async createNotification(input: CreateNotificationInput) {
        return this.prisma.notification.create({
            data: input,
        });
    }

    async getNotificationsByReceiverId(user: UserPayload) {
        const notifications = await this.prisma.notification.findMany({
            where: {
                receiverId: user.id,
            },
        });
        return {
            message: "Notifications fetched successfully",
            data: {
                notifications,
            },
        };
    }
}
