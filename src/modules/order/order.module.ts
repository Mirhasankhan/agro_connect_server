import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";
import { StripeService } from "@/core/services/stripe/stripe.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
    imports: [
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
        JwtModule.register({ global: true }),
    ],
    providers: [OrderService, StripeService],
    controllers: [OrderController, StripeWebhookController],
    exports: [OrderService],
})
export class OrderModule {}
