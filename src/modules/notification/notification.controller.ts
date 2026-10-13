import { Controller, Get, HttpStatus, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { ResponseService } from "@/common/interceptors/response";
import { Request } from "express";

@ApiTags("Notification")
@Controller("notification")
export class NotificationController {
    constructor(private notification: NotificationService) {}

    @Get("user-wise")
    @ApiOperation({ summary: "Get notifications for a specific user" })
    async notifications(@Req() req: Request) {
        const result = await this.notification.getNotificationsByReceiverId(
            req.user,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }
}
