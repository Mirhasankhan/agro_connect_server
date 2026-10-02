import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { ProductService } from "./product.service";
import { ProductController } from "./product.controller";


@Module({
    imports: [HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
    }),
    JwtModule.register({ global: true })
    ],
    providers: [ProductService],
    controllers: [ProductController],
    exports: [ProductService],
})

export class ProductModule {}