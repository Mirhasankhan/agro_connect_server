import { IsPublic } from "@/common/decorators/auth.decorator";
import { BadRequestException, Controller, Post, Req } from "@nestjs/common";
import { RawBodyRequest } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { OrderService } from "./order.service";

@ApiTags("Stripe Webhook")
@Controller("webhook")
export class StripeWebhookController {
    constructor(private orderService: OrderService) {}

    @Post("stripe")
    @IsPublic()
    @ApiOperation({ summary: "Handle Stripe checkout webhook events" })
    async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
        console.log("Received Stripe webhook event:", req.body);
        const signature = req.headers["stripe-signature"];

        if (typeof signature !== "string") {
            throw new BadRequestException("Missing Stripe webhook signature");
        }

        if (!req.rawBody) {
            throw new BadRequestException("Missing Stripe webhook payload");
        }

        return this.orderService.handleStripeWebhook(req.rawBody, signature);
    }
}
