import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { ShoppingService } from "./shopping.service";
import { ShoppingController } from "./shopping.controller";


@Module({
    imports: [HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
    }),
    JwtModule.register({ global: true })
    ],
    providers: [ShoppingService],
    controllers: [ShoppingController],
    exports: [ShoppingService],
})

export class ShoppingModule {}