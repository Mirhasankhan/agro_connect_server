import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { OrderService } from "./order.service";
import { ConfirmDeliveryDto, CreateOrderDto, DeliveryDto, OrderQueryDto } from "./dto/body.dto";

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

    @Get("user-wise")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Get user's orders" })
    async getUserOrders(@Req() req: Request, @Query() query: OrderQueryDto) {
        const user = req.user as UserPayload;
        const result = await this.orderService.getUserOrders(user, query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("producer-wise")
    @Roles(UserRole.PRODUCER)
    @ApiOperation({ summary: "Get producer's orders" })
    async getProducerWiseOrders(@Req() req: Request, @Query() query: OrderQueryDto) {
        const user = req.user as UserPayload;
        const result = await this.orderService.getProducerWiseOrders(user, query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("details/:id")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Get order by ID" })
    async getOrderById(@Req() req: Request, @Param("id") orderId: string) {
        const user = req.user as UserPayload;
        const result = await this.orderService.getOrderById(user, orderId);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Put("delivery/update-status")
    @Roles(UserRole.DRIVER)
    @ApiOperation({ summary: "Mark delivery as picked up or canceled" })
    async markDeliveryAsPickedUpOrCanceled(
        @Body() payload: DeliveryDto,
        @Req() req: Request,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.markDeliveryAsPickedUpOrCanceled(payload, user);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Patch("/send-completion-otp/:id")
    @Roles(UserRole.DRIVER)
    @ApiOperation({ summary: "Send delivery completion OTP" })
    async sendDeliveryCompletionOtp(
        @Param("id") id: string,
        @Req() req: Request,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.sendDeliveryCompletionOtp(id, user);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Post("/verify-completion-otp")
    @Roles(UserRole.DRIVER)
    @ApiOperation({ summary: "Verify delivery completion OTP" })
    async verifyDeliveryCompletionOtp(
        @Body() payload: ConfirmDeliveryDto,
        @Req() req: Request,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.verifyDeliveryCompletionOtp(payload, user);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

}
