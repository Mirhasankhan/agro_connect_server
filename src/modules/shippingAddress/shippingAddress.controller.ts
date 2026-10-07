import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ShippingAddressService } from "./shippingAddress.service";
import { ShippingAddressDto } from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";


@ApiTags("Shipping Address")
@Controller("shipping-address")
export class ShippingAddressController {
    constructor(private shippingAddressService: ShippingAddressService) { }

    @HttpCode(HttpStatus.CREATED)
    @Post("create")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Create Shipping Address" })
    async createShippingAddress(@Body() payload: ShippingAddressDto, @Req() req: Request) {
        const result = await this.shippingAddressService.createShippingAddress(payload, req.user as UserPayload);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }


    @Get()
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Get Shipping Address" })
    async getShippingAddresses(@Req() req: Request) {
        const result = await this.shippingAddressService.getShippingAddress(req.user as UserPayload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data            
        })
    }

}


