import { PrismaService } from "@/core/services/prisma/prisma.service";
import { Injectable, HttpStatus } from "@nestjs/common";
import { UserPayload } from "@/common/guards/auth.guard";
import { FileService } from "@/core/services/files/cloudinary.service";
import {
    CreateDriverReviewDto,
    CreateReviewDto,
    SendSupportDto,
} from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class FeedbackService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService,
        private notificationService: NotificationService,
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
                    product :{
                        select :{
                            producerId:true
                        }
                    }
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

        // background.add(async () => {
            
        //     await this.notificationService.createNotification({
        //         receiverId: orderItem.product.producerId,
        //         title: "You have a new review!",
        //         content:
        //             "A new review has been submitted for your product. Please review and respond to the review.",
        //         notificationType: "Review",
        //     });
        // });

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

    async createDriverReview(
        user: UserPayload,
        payload: CreateDriverReviewDto,
    ) {
        await this.prisma.$transaction(async (tx) => {
            const [order, existingReview] = await Promise.all([
                tx.order.findUniqueOrThrow({
                    where: {
                        id: payload.orderId,
                        customerId: user.id,
                        status: "Delivered",
                    },
                    select: {
                        id: true,
                        deliveries: {
                            select: {
                                driverId: true,
                            },
                            take: 1,
                        },
                    },
                }),
                tx.driverReview.findUnique({
                    where: {
                        orderId: payload.orderId,
                    },
                    select: {
                        id: true,
                    },
                }),
            ]);

            if (existingReview) {
                throw new ApiError(
                    HttpStatus.BAD_REQUEST,
                    "Driver review already submitted for this order",
                );
            }

            const driverId = order.deliveries[0]?.driverId;

            if (!driverId) {
                throw new ApiError(
                    HttpStatus.BAD_REQUEST,
                    "No driver found for this order",
                );
            }

            await tx.driverReview.create({
                data: {
                    orderId: order.id,
                    buyerId: user.id,
                    rating: payload.rating,
                    comment: payload.comment,
                },
                select: {
                    id: true,
                },
            });

            const driverReviews = await tx.driverReview.findMany({
                where: {
                    order: {
                        deliveries: {
                            some: {
                                driverId,
                            },
                        },
                    },
                },
                select: {
                    rating: true,
                },
            });

            const totalReviews = driverReviews.length;
            const averageRating =
                totalReviews > 0
                    ? driverReviews.reduce(
                          (total, review) => total + review.rating,
                          0,
                      ) / totalReviews
                    : 0;

            await tx.driverProfile.update({
                where: {
                    userId: driverId,
                },
                data: {
                    totalReviews,
                    avgRating: Number(averageRating.toFixed(1)),
                },
                select: {
                    avgRating: true,
                    totalReviews: true,
                },
            });
        });

        return {
            message: "Driver review submitted successfully",
        };
    }
}
