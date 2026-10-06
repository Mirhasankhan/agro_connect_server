import { ResponseService } from "@/common/interceptors/response";
import { Post, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Controller, Body, Req } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { CreateReviewDto } from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";

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
}
