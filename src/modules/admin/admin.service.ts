import QueryBuilder from "@/common/utils/queryBuilder";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
    AcceptRejectAccountDto,
    CategoryDto,
    DriverQueryDto,
    ProducerQueryDto,
    AssignDriverDto,
    BaseUserQueryDto,
    CreateCouponDto,
    UpdateTermsDto,
} from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import { FileService } from "@/core/services/files/cloudinary.service";
import { OrderQueryDto } from "../order/dto/body.dto";

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService,
    ) {}

    async getAllProducerFromDB(query: ProducerQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.user, query);

        const response = queryBuilder
            .search(["email", "fullName"])
            .filter({
                exacts: ["verificationStatus", "producerType"],
                nestedFields: {
                    verificationStatus: "producerProfile.verificationStatus",
                    producerType: "producerProfile.producerType",
                },
            })
            .rawFilter({
                role: {
                    equals: UserRole.PRODUCER,
                },
            })
            .sort()
            .paginate()
            .select({
                id: true,
                fullName: true,
                email: true,
                profileImage: true,
                _count: {
                    select: {
                        products: true,
                    },
                },
                producerProfile: {
                    select: {
                        farmName: true,
                        allTimeEarnings: true,
                        verificationStatus: true,
                        producerType: true,
                    },
                },
            });

        const [
            allProducer,
            pagination,
            pendingReview,
            certified,
            productCount,
        ] = await Promise.all([
            response.execute(),
            response.countTotal(),
            this.prisma.producerProfile.count({
                where: {
                    verificationStatus: "Pending",
                },
            }),
            this.prisma.producerProfile.count({
                where: {
                    verificationStatus: "Accepted",
                },
            }),
            this.prisma.product.count(),
        ]);

        return {
            data: {
                users: allProducer,
                meta: {
                    ...pagination,
                    pendingReview,
                    certified,
                    productCount,
                },
            },
            message: "All producer fetched successfully",
        };
    }

    async acceptRejectProducerAccount(payload: AcceptRejectAccountDto) {
        await this.prisma.producerProfile.findUniqueOrThrow({
            where: {
                userId: payload.accountId,
                verificationStatus: {
                    in: ["Pending", "Rejected"],
                },
            },
        });

        if (!payload.isAccept && !payload.rejectReason) {
            throw new ApiError(
                HttpStatus.FORBIDDEN,
                "Reject reason is required",
            );
        }

        await this.prisma.producerProfile.update({
            where: { userId: payload.accountId },
            data: {
                verificationStatus: payload.isAccept ? "Accepted" : "Rejected",
                rejectionReason: payload.isAccept ? null : payload.rejectReason,
            },
        });

        return {
            message: `${payload.isAccept ? "Accepted" : "Rejected"} producer account successfully`,
        };
    }

    async getAllDriverFromDB(query: DriverQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.user, query);

        const response = queryBuilder
            .search(["email", "fullName"])
            .filter({
                exacts: ["vehicleType", "verificationStatus"],
                nestedFields: {
                    vehicleType: "driverProfile.vehicleType",
                    verificationStatus: "driverProfile.verificationStatus",
                },
            })
            .rawFilter({
                role: {
                    equals: UserRole.DRIVER,
                },
            })
            .sort()
            .paginate()
            .select({
                id: true,
                fullName: true,
                email: true,
                profileImage: true,
                _count: {
                    select: {
                        deliveries: true,
                    },
                },
                driverProfile: {
                    select: {
                        avgRating: true,
                        verificationStatus: true,
                        vehicleType: true,
                        isAvailable: true,
                        phoneNumber: true,
                    },
                },
            });

        const [allDriver, pagination, activeDriversCount, pendingDriversCount] =
            await Promise.all([
                response.execute(),
                response.countTotal(),
                this.prisma.driverProfile.count({
                    where: {
                        verificationStatus: "Accepted",
                    },
                }),
                this.prisma.driverProfile.count({
                    where: {
                        verificationStatus: "Pending",
                    },
                }),
            ]);

        return {
            data: {
                users: allDriver,
                meta: {
                    ...pagination,
                    activeDriversCount,
                    pendingDriversCount,
                },
            },
            message: "All driver fetched successfully",
        };
    }

    async getAllBuyerFromDB(query: BaseUserQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.user, query);

        const response = queryBuilder
            .search(["email", "fullName"])
            .rawFilter({
                role: {
                    equals: UserRole.BUYER,
                },
            })
            .sort()
            .paginate()
            .select({
                id: true,
                fullName: true,
                email: true,
                profileImage: true,
                status: true,
                _count: {
                    select: {
                        orders: {
                            where: { paymentStatus: "Paid" },
                        },
                    },
                },

                buyerProfile: {
                    select: {
                        phoneNumber: true,
                        profileType: true,
                        city: true,
                    },
                },
            });

        const [allBuyer, pagination, suspended] = await Promise.all([
            response.execute(),
            response.countTotal(),
            this.prisma.user.count({
                where: {
                    role: UserRole.BUYER,
                    status: "SUSPENDED",
                },
            }),
        ]);

        return {
            data: {
                users: allBuyer,
                meta: {
                    ...pagination,
                    suspended,
                },
            },
            message: "All buyer fetched successfully",
        };
    }

    async acceptRejectDriverAccount(payload: AcceptRejectAccountDto) {
        await this.prisma.driverProfile.findUniqueOrThrow({
            where: {
                userId: payload.accountId,
                verificationStatus: "Pending",
            },
        });

        if (!payload.isAccept && !payload.rejectReason) {
            throw new ApiError(
                HttpStatus.FORBIDDEN,
                "Reject reason is required",
            );
        }

        await this.prisma.driverProfile.update({
            where: { userId: payload.accountId },
            data: {
                verificationStatus: payload.isAccept ? "Accepted" : "Rejected",
                rejectionReason: payload.isAccept ? null : payload.rejectReason,
            },
        });

        return {
            message: `${payload.isAccept ? "Accepted" : "Rejected"} driver account successfully`,
        };
    }

    async createNewCategory(payload: CategoryDto, file?: Express.Multer.File) {
        const existingCategory = await this.prisma.category.findUnique({
            where: {
                slug: payload.slug,
            },
            select: {
                slug: true,
            },
        });

        if (existingCategory) {
            throw new ApiError(HttpStatus.CONFLICT, "Category already exists");
        }

        let imageUrl = null;
        if (file) {
            imageUrl = await this.fileService.uploadToCloudinary(file);
        }

        if (!imageUrl) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "Image upload failed");
        }

        await this.prisma.category.create({
            data: {
                ...payload,
                imageUrl,
            },
        });

        return {
            message: "Category created successfully",
        };
    }

    async getAllCategories() {
        const categories = await this.prisma.category.findMany({
            omit: {
                createdAt: true,
                updatedAt: true,
            },
        });

        return {
            data: categories,
            message: "All categories fetched successfully",
        };
    }

    async toggleCategoryStatus(categoryId: string) {
        const category = await this.prisma.category.findUniqueOrThrow({
            where: {
                id: categoryId,
            },
            select: {
                id: true,
                isActive: true,
            },
        });

        await this.prisma.category.update({
            where: {
                id: categoryId,
            },
            data: {
                isActive: !category.isActive,
            },
        });

        return {
            message: `Category ${category.isActive ? "Deactived" : "Actived"} successfully`,
        };
    }

    async assignDriverToDelivery(payload: AssignDriverDto) {
        const [order, driver] = await Promise.all([
            this.prisma.order.findUnique({
                where: {
                    id: payload.orderId,
                    status: "Active",
                    paymentStatus: "Paid",
                },
                select: {
                    deliveries: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                },
            }),
            this.prisma.user.findUnique({
                where: {
                    id: payload.driverId,
                    role: UserRole.DRIVER,
                },
                select: {
                    id: true,
                    driverProfile: {
                        select: {
                            verificationStatus: true,
                            isAvailable: true,
                        },
                    },
                },
            }),
        ]);

        if (!order) {
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                "Order not found or not eligible for delivery",
            );
        }

        if (order.deliveries.length > 0) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                "Driver already assigned to this order",
            );
        }

        if (!driver) {
            throw new ApiError(HttpStatus.NOT_FOUND, "Driver not found");
        }

        if (driver.driverProfile.verificationStatus !== "Accepted") {
            throw new ApiError(HttpStatus.FORBIDDEN, "Driver is not verified");
        }

        if (!driver.driverProfile.isAvailable) {
            throw new ApiError(HttpStatus.FORBIDDEN, "Driver is not available");
        }

        await this.prisma.$transaction(async (tx) => {
            const driver = await tx.driverProfile.updateMany({
                where: {
                    userId: payload.driverId,
                },
                data: {
                    isAvailable: false,
                },
            });

            if (driver.count === 0) {
                throw new BadRequestException("Driver is no longer available");
            }

            await tx.delivery.create({
                data: {
                    orderId: payload.orderId,
                    driverId: payload.driverId,
                },
            });
        });

        return {
            message: "Driver assigned to delivery successfully",
        };
    }

    async createNewCoupon(payload: CreateCouponDto) {
        const existingCoupon = await this.prisma.coupon.findUnique({
            where: {
                code: payload.code,
            },
            select: {
                code: true,
            },
        });

        if (existingCoupon) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                "Coupon code already exists",
            );
        }
        await this.prisma.coupon.create({
            data: {
                code: payload.code,
                discount: payload.discount,
                expiresAt: payload.expiryDate,
            },
        });

        return {
            message: "Coupon created successfully",
        };
    }

    async updateTerms(payload: UpdateTermsDto) {
        const existingTerms = await this.prisma.term.findFirst({});
        if (!existingTerms) {
            await this.prisma.term.create({
                data: {
                    content: payload.content,
                },
            });
        }

        await this.prisma.term.update({
            where: { id: existingTerms.id },
            data: { content: payload.content },
        });

        return {
            message: "Terms updated successfully",
        };
    }

    async getAllOrdersFromDB(query: OrderQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.order, query);

        const response = queryBuilder
            .search(["orderId", "customer.fullName", "customer.email"])
            .sort()
            .filter({ exacts: ["status"] })
            .rawFilter({
                paymentStatus: "Paid",
            })
            .paginate()
            .select({
                id: true,
                orderId: true,
                status: true,
                totalAmount: true,
                createdAt: true,
                _count: {
                    select: {
                        items: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        profileImage: true,
                    },
                },
            });

        const [allOrders, pagination, completed, cancelled] = await Promise.all(
            [
                response.execute(),
                response.countTotal(),
                this.prisma.order.count({
                    where: {
                        status: "Delivered",
                        paymentStatus: "Paid",
                    },
                }),
                this.prisma.order.count({
                    where: {
                        status: "Cancelled",
                        paymentStatus: "Paid",
                    },
                }),
            ],
        );

        const totalAmount = await this.prisma.order.aggregate({
            where: {
                paymentStatus: "Paid",
            },
            _sum: {
                totalAmount: true,
            },
        });

        return {
            message: "All orders fetched successfully",
            data: {
                orders: allOrders,
                meta: {
                    ...pagination,
                    completed,
                    cancelled,
                    totalAmount: totalAmount._sum.totalAmount ?? 0,
                },
            },
        };
    }

    async getOrderById(orderId: string) {
        const order = await this.prisma.order.findUniqueOrThrow({
            where: {
                id: orderId,
            },
            select: {
                id: true,
                orderId: true,
                status: true,
                createdAt: true,
                totalAmount: true,
                cancelReason: true,
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        profileImage: true,
                    },
                },
                shippingAddress: {
                    select: {
                        addressLine: true,
                        city: true,
                        instruction: true,
                        postCode: true,
                    },
                },
                items: {
                    select: {
                        id: true,
                        productName: true,
                        quantity: true,
                        unitPrice: true,
                        subtotal: true,
                        sellingUnit: true,
                        product: {
                            select: {
                                imageUrls: true,
                                producer: {
                                    select: {
                                        fullName: true,
                                        profileImage: true,
                                        producerProfile: {
                                            select: {
                                                farmName: true,
                                                address: true,
                                                city: true,
                                                farmSize: true,
                                                producerType: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                deliveries: {
                    select: {
                        id: true,
                        status: true,
                        latitude: true,
                        longitude: true,
                        updatedAt: true,
                        driver: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                profileImage: true,
                                driverProfile: {
                                    select: {
                                        phoneNumber: true,
                                        registrationNumber: true,
                                        vehicleType: true,
                                        vehicleColor: true,
                                        vehiclePhotoUrl: true,
                                        model: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        return {
            message: "Order fetched successfully",
            data: order,
        };
    }
}
