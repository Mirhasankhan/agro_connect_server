import { Body, Controller, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dto/body.dto";

@ApiTags("Order")
@Controller("order")
export class OrderController {
    constructor(private orderService: OrderService) {}

    @Post("create")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Create a new order" })
    async createOrder(@Body() payload: CreateOrderDto, @Req() req: Request) {
        const user = req.user as UserPayload;
        const result = await this.orderService.createOrder(user, payload);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: {
                orderId: result.orderId,
                checkOutUrl: result.checkoutSessionUrl,
            },
        });
    }
}
