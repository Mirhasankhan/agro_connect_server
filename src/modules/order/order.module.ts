import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";
import { CinetPayService } from "@/core/services/cinetpay/cinetpay.service";
import { CinetpayWebhookController } from "./cinetpay-webhook.controller";

@Module({
    imports: [
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
        JwtModule.register({ global: true }),
    ],
    providers: [OrderService, CinetPayService],
    controllers: [OrderController, CinetpayWebhookController],
    exports: [OrderService, CinetPayService],
})
export class OrderModule {}
