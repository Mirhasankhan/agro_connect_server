import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { ShippingAddressService } from "./shippingAddress.service";
import { ShippingAddressController } from "./shippingAddress.controller";

@Module({
    imports: [HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
    }),
    JwtModule.register({ global: true })
    ],
    providers: [ShippingAddressService],
    controllers: [ShippingAddressController],
    exports: [ShippingAddressService],
})

export class ShippingAddressModule {}