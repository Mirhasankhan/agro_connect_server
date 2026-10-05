import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";


@Module({
    imports: [
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
        JwtModule.register({ global: true }),
    ],
    providers: [PaymentService],
    controllers: [PaymentController],
    exports: [PaymentService],
})
export class PaymentModule {}
