import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Post,
    Query,
    Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { EarningSummaryQueryDto, WithdrawQueryDto, WithdrawRequestDto } from "./dto/body.dto";
import { Request } from "express";
import { UserPayload } from "@/common/guards/auth.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { ResponseService } from "@/common/interceptors/response";

@ApiTags("Payment")
@Controller("payment")
export class PaymentController {
    constructor(private paymentService: PaymentService) {}

    @Get("producer-earnings")
    @Roles(UserRole.PRODUCER)
    @ApiOperation({ summary: "Get producer earnings summary" })
    async getProducerEarningSummary(
        @Query() query: EarningSummaryQueryDto,
        @Req() req: Request,
    ) {
        const result = await this.paymentService.getProducerEarningSummary(
            req.user as UserPayload,
            query,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Post("withdraw")
    @Roles(UserRole.PRODUCER, UserRole.DRIVER)
    @ApiOperation({ summary: "Send withdraw request" })
    async sendWithdrawRequest(
        @Body() payload: WithdrawRequestDto,
        @Req() req: Request,
    ) {
        const result = await this.paymentService.sendWithdrawRequest(
            req.user as UserPayload,
            payload,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("withdraw-requests")
    @Roles(UserRole.PRODUCER, UserRole.DRIVER)
    @ApiOperation({ summary: "Get user withdraw requests" })
    async getUserWithdrawRequests(
        @Query() query: WithdrawQueryDto,
        @Req() req: Request,
    ) {
        const result = await this.paymentService.getUserWithdrawRequests(
            req.user as UserPayload,
            query,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }
}
