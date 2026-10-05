import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { UserPayload } from "@/common/guards/auth.guard";
import { ResponseService } from "@/common/interceptors/response";
import { Request } from "express";
import { HttpStatus } from "@nestjs/common";
import { PaymentQueryDto } from "./dto/body.dto";

@ApiTags("Payment")
@Controller("payment")
export class PaymentController {
    constructor(private paymentService: PaymentService) {}

    @Get("producer-wise")
    @Roles(UserRole.PRODUCER)
    @ApiOperation({ summary: "Get producer wise payments" })
    async producersEarnings(@Req() req: Request, @Query() query: PaymentQueryDto) {
        const user = req.user as UserPayload;
        const result = await this.paymentService.getProducerWisePayments(user, query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("driver-wise")
    @Roles(UserRole.DRIVER)
    @ApiOperation({ summary: "Get driver wise payments" })
    async driverEarnings(@Req() req: Request, @Query() query: PaymentQueryDto) {
        const user = req.user as UserPayload;
        const result = await this.paymentService.getDriverWisePayments(user, query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }
}
