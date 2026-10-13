import { PrismaService } from "@/core/services/prisma/prisma.service";
import { Injectable, HttpStatus } from "@nestjs/common";
import { UserPayload } from "@/common/guards/auth.guard";
import { FileService } from "@/core/services/files/cloudinary.service";
import { CreateReviewDto, SendSupportDto } from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";

@Injectable()
export class FeedbackService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService,
    ) {}

    async submitReview(user: UserPayload, payload: CreateReviewDto) {
        await this.prisma.$transaction(async (tx) => {
            const orderItem = await tx.orderItem.findUnique({
                where: {
                    id: payload.orderItemId,
                    isReviewed: false,
                    order: { customerId: user.id, status: "Delivered" },
                },
                select: {
                    id: true,
                    productId: true,
                },
            });

            if (!orderItem) {
                throw new ApiError(
                    HttpStatus.BAD_REQUEST,
                    "Invalid order item or already reviewed",
                );
            }

            await tx.review.create({
                data: {
                    rating: payload.rating,
                    comment: payload.comment,
                    orderItemId: payload.orderItemId,
                    productId: orderItem.productId,
                    buyerId: user.id,
                },
            });

            await tx.orderItem.update({
                where: { id: payload.orderItemId },
                data: { isReviewed: true },
            });

            const reviewAverage = await tx.review.aggregate({
                where: { productId: orderItem.productId },
                _avg: { rating: true },
            });

            await tx.product.update({
                where: { id: orderItem.productId },
                data: {
                    totalReviews: { increment: 1 },
                    avgRating: Number(
                        (reviewAverage._avg.rating ?? 0).toFixed(1),
                    ),
                },
            });
        });

        return {
            message: "Review submitted successfully",
        };
    }

    async getTerms() {
        const terms = await this.prisma.term.findFirst({
            select: {
                content: true,
            },
        });

        return {
            message: "Terms fetched successfully",
            data: terms,
        };
    }

    async sendSupport(
        user: UserPayload,
        payload: SendSupportDto,
        files: Express.Multer.File[] = [],
    ) {
        const fileurls = files.length
            ? await Promise.all(
                  files.map((file) =>
                      this.fileService.uploadToCloudinary(file, "support"),
                  ),
              )
            : [];

        await this.prisma.support.create({
            data: {
                userId: user.id,
                subject: payload.subject,
                message: payload.message,
                fileurls,
            },
        });

        return {
            message: "Support request sent successfully",
        };
    }
}
