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
import {
    ConfirmDeliveryDto,
    CreateOrderDto,
    DeliveryDto,
    OrderQueryDto,
    ApplyCouponDto,
    StartNavigationDto,
} from "./dto/body.dto";
import { IsPublic } from "@/common/decorators/auth.decorator";

@ApiTags("Order")
@Controller("order")
export class OrderController {
    constructor(private orderService: OrderService) {}

    @Post("create")
    @Roles(UserRole.BUYER)
    @ApiOperation({
        summary: "Create a new order and generate CinetPay checkout URL",
    })
    async createOrder(@Body() payload: CreateOrderDto, @Req() req: Request) {
        const user = req.user as UserPayload;
        const result = await this.orderService.createOrderForTesting(
            user,
            payload,
        );
        // const result = await this.orderService.createOrderWithCinetPay(
        //     user,
        //     payload,
        // );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: {
                orderId: result.orderId,
                checkOutUrl: result.checkoutSessionUrl,
                transactionId: result.transactionId,
            },
        });
    }

    @Post("checkout/:orderId")
    @Roles(UserRole.BUYER)
    @ApiOperation({
        summary: "Initiate CinetPay checkout for an existing order",
    })
    async initiateCheckout(
        @Param("orderId") orderId: string,
        @Req() req: Request,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.initiateCheckoutForOrder(
            user,
            orderId,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: {
                orderId: result.orderId,
                checkOutUrl: result.checkoutSessionUrl,
                paymentUrl: result.paymentUrl,
                transactionId: result.transactionId,
            },
        });
    }

    @Post("verify/:transactionId")
    @Roles(UserRole.BUYER)
    @ApiOperation({
        summary: "Verify CinetPay payment status server-to-server",
    })
    async verifyPayment(
        @Param("transactionId") transactionId: string,
        @Req() req: Request,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.verifyPayment(
            user,
            transactionId,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
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
    async getProducerWiseOrders(
        @Req() req: Request,
        @Query() query: OrderQueryDto,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.getProducerWiseOrders(
            user,
            query,
        );
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

    @Get("item/details/:id")
    @Roles(UserRole.PRODUCER)
    @ApiOperation({ summary: "Get order item details for producer" })
    async getOrderItemDetailsForProducer(
        @Req() req: Request,
        @Param("id") orderItemId: string,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.getOrderItemDetailsForProducer(
            user,
            orderItemId,
        );
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
        const result = await this.orderService.markDeliveryAsPickedUpOrCanceled(
            payload,
            user,
        );
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
        const result = await this.orderService.sendDeliveryCompletionOtp(
            id,
            user,
        );
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
        const result = await this.orderService.verifyDeliveryCompletionOtp(
            payload,
            user,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Post("/apply-coupon")
    @IsPublic()
    @ApiOperation({ summary: "Apply a coupon to the current order" })
    async applyCoupon(@Body() payload: ApplyCouponDto) {
        const result = await this.orderService.applyCoupon(payload);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Patch("/update-navigation")
    @Roles(UserRole.DRIVER)
    @ApiOperation({ summary: "Update navigation for the current order" })
    async updateNavigation(
        @Req() req: Request,
        @Body() payload: StartNavigationDto,
    ) {
        const user = req.user as UserPayload;
        const result = await this.orderService.updateNavigation(user, payload);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }
}
