import { IsPublic } from "@/common/decorators/auth.decorator";
import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrderService } from "./order.service";

@ApiTags("CinetPay Webhook")
@Controller("webhook")
export class CinetpayWebhookController {
    constructor(private orderService: OrderService) {}

    @Post("cinetpay")
    @HttpCode(HttpStatus.OK)
    @IsPublic()
    @ApiOperation({
        summary: "Handle CinetPay checkout notification/webhook events",
    })
    async handleCinetPayWebhook(
        @Body() body: Record<string, unknown>,
        @Query() query: Record<string, unknown>,
    ) {
        const payload: Record<string, unknown> = { ...query, ...body };
        return this.orderService.handleCinetPayWebhook(payload);
    }

    @Post("cinetpay/notify")
    @HttpCode(HttpStatus.OK)
    @IsPublic()
    @ApiOperation({
        summary: "Handle CinetPay notification at /notify endpoint",
    })
    async handleCinetPayNotify(
        @Body() body: Record<string, unknown>,
        @Query() query: Record<string, unknown>,
    ) {
        const payload: Record<string, unknown> = { ...query, ...body };
        return this.orderService.handleCinetPayWebhook(payload);
    }
}
