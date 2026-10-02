import { AuthModule } from "@/modules/auth/auth.module";
import { GlobalExceptionFilter } from "@/common/filters/global_exception";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AuthGuard } from "@/common/guards/auth.guard";
import { CommonModule } from "@/common/common.module";
import { ShippingAddressModule } from "@/modules/shippingAddress/shippingAddress.module";
import { AdminModule } from "@/modules/admin/admin.module";
import { ProductModule } from "@/modules/product/product.module";
import { ShoppingModule } from "@/modules/shopping/shopping.module";
import { OrderModule } from "@/modules/order/order.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, "..", "..", "uploads"),
            serveRoot: "/uploads",
        }),
        ThrottlerModule.forRoot({
            throttlers: [
                {
                    name: "short",
                    ttl: 1000,
                    limit: 100,
                },
                {
                    name: "medium",
                    ttl: 10000,
                    limit: 1000,
                },
                {
                    name: "long",
                    ttl: 600000,
                    limit: 1000,
                },
            ],
        }),
        OrderModule,
        ProductModule,
        ShoppingModule,
        AuthModule,
        ShippingAddressModule,
        AdminModule,
        CommonModule,
    ],
    controllers: [AppController],
    providers: [
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
    ],
})
export class AppModule {}
