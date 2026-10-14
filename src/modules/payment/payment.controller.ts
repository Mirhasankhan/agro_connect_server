import {
    Controller,
    Get,
    HttpStatus,
    Query,
    Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { EarningSummaryQueryDto } from "./dto/body.dto";
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
}
