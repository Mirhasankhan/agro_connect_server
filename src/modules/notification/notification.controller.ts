import { Controller, Get, HttpStatus, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { ResponseService } from "@/common/interceptors/response";
import { Request } from "express";
import { NotificationQueryDto } from "../product/dto/body.dto";

@ApiTags("Notification")
@Controller("notification")
export class NotificationController {
    constructor(private notification: NotificationService) {}

    @Get("user-wise")
    @ApiOperation({ summary: "Get notifications for a specific user" })
    async notifications(
        @Req() req: Request,
        @Query() query: NotificationQueryDto,
    ) {
        const result = await this.notification.getNotificationsByReceiverId(
            req.user,
            query,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }
}
