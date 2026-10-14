import { ResponseService } from "@/common/interceptors/response";
import {
    Post,
    HttpStatus,
    Get,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Controller, Body, Req } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { CreateReviewDto, SendSupportDto } from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";
import { CustomFilesInterceptor } from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Feedback")
@Controller("feedback")
export class FeedbackController {
    constructor(private feedbackService: FeedbackService) {}

    @Post("submit-review")
    @ApiOperation({ summary: "Submit Review to an Order Item" })
    async submitReview(@Body() payload: CreateReviewDto, @Req() req: Request) {
        const user = req.user as UserPayload;
        const result = await this.feedbackService.submitReview(user, payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("terms")
    @ApiOperation({ summary: "Get Terms and Conditions" })
    async getTerms() {
        const result = await this.feedbackService.getTerms();

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Post("support")
    @ApiOperation({ summary: "Send a support request" })
    @Roles(UserRole.BUYER, UserRole.DRIVER, UserRole.PRODUCER)
    @UseInterceptors(CustomFilesInterceptor("files"), ParseFormDataInterceptor)
    async sendSupport(
        @Body() payload: SendSupportDto,
        @Req() req: Request,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        const user = req.user as UserPayload;
        const result = await this.feedbackService.sendSupport(
            user,
            payload,
            files,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }
}
