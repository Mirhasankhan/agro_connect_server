import { UserPayload } from "@/common/guards/auth.guard";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { CinetPayService } from "@/core/services/cinetpay/cinetpay.service";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import {
    ConfirmDeliveryDto,
    CreateOrderDto,
    DeliveryDto,
    OrderQueryDto,
} from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import QueryBuilder from "@/common/utils/queryBuilder";
import { BcryptService } from "@/common/utils/bcrypt.service";
import config from "@/config";
import { generateOrderId, generateOTP } from "../auth/auth.utils";
import { emailBodyForDeliveryCompletion } from "../auth/auth.template";
import sendEmail from "@/core/services/email";

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        private prisma: PrismaService,
        private bcryptService: BcryptService,
        private cinetpay: CinetPayService,
    ) {}

    // async createOrder(user: UserPayload, payload: CreateOrderDto) {
    //     const shippingAddress =
    //         await this.prisma.shippingAddress.findUniqueOrThrow({
    //             where: {
    //                 id: payload.shippingAddressId,
    //                 userId: user.id,
    //             },
    //             select: {
    //                 id: true,
    //             },
    //         });

    //     const rawCartIds = payload.cartIds;

    //     const cartIds = Array.isArray(rawCartIds)
    //         ? Array.from(new Set(rawCartIds.filter(Boolean)))
    //         : [];

    //     if (cartIds.length === 0) {
    //         throw new ApiError(
    //             HttpStatus.BAD_REQUEST,
    //             "At least one cart item is required to create an order",
    //         );
    //     }

    //     const carts = await this.prisma.cart.findMany({
    //         where: {
    //             userId: user.id,
    //             id: {
    //                 in: cartIds,
    //             },
    //         },
    //         select: {
    //             id: true,
    //             quantity: true,
    //             product: {
    //                 select: {
    //                     id: true,
    //                     name: true,
    //                     sellingUnit: true,
    //                     availableQuantity: true,
    //                     pricePerUnit: true,
    //                 },
    //             },
    //         },
    //     });

    //     if (carts.length !== cartIds.length) {
    //         throw new ApiError(
    //             HttpStatus.BAD_REQUEST,
    //             "Some cart ids are invalid or do not belong to this user",
    //         );
    //     }

    //     const unavailableCart = carts.find(
    //         (cart) => cart.quantity > cart.product.availableQuantity,
    //     );

    //     if (unavailableCart) {
    //         throw new ApiError(
    //             HttpStatus.BAD_REQUEST,
    //             `Insufficient quantity available for ${unavailableCart.product.name}`,
    //         );
    //     }

    //     const items = carts.map((cart) => ({
    //         productId: cart.product.id,
    //         quantity: cart.quantity,
    //         productName: cart.product.name,
    //         sellingUnit: cart.product.sellingUnit,
    //         unitPrice: cart.product.pricePerUnit as number,
    //         subtotal: cart.quantity * (cart.product.pricePerUnit as number),
    //     }));

    //     const totalAmount =
    //         Math.round(
    //             items.reduce((total, item) => total + item.subtotal, 0) * 100,
    //         ) / 100;

    //     const orderId = generateOrderId();

    //     const order = await this.prisma.$transaction(async (transaction) => {
    //         const order = await transaction.order.create({
    //             data: {
    //                 orderId,
    //                 customerId: user.id,
    //                 shippingAddressId: shippingAddress.id,
    //                 status: "Pending",
    //                 totalAmount,
    //                 paymentStatus: "Pending",
    //                 items: {
    //                     create: items.map((item) => ({
    //                         ...item,
    //                         status: "Pending",
    //                     })),
    //                 },
    //             },
    //         });

    //         return order;
    //     });

    //     const checkoutSession = await this.stripe.createCheckoutSession({
    //         line_items: items.map((item) => ({
    //             price_data: {
    //                 currency: "usd",
    //                 product_data: {
    //                     name: item.productName,
    //                     description: `Sold by ${item.sellingUnit}`,
    //                 },
    //                 unit_amount: Math.round(item.unitPrice * 100),
    //             },
    //             quantity: item.quantity,
    //         })),
    //         client: {
    //             id: user.id,
    //             email: user.email,
    //         },
    //         metadata: {
    //             orderId: order.id,
    //             customerId: user.id,
    //         },
    //     });

    //     return {
    //         message: "Order created successfully",
    //         orderId,
    //         checkoutSessionUrl: checkoutSession.url,
    //     };
    // }

    async createOrderForTesting(user: UserPayload, payload: CreateOrderDto) {
        const shippingAddress =
            await this.prisma.shippingAddress.findUniqueOrThrow({
                where: {
                    id: payload.shippingAddressId,
                    userId: user.id,
                },
                select: {
                    id: true,
                },
            });

        const cartIds = Array.isArray(payload.cartIds)
            ? Array.from(new Set(payload.cartIds.filter(Boolean)))
            : [];

        if (cartIds.length === 0) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "At least one cart item is required to create an order",
            );
        }

        const carts = await this.prisma.cart.findMany({
            where: {
                userId: user.id,
                id: {
                    in: cartIds,
                },
            },
            select: {
                id: true,
                quantity: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        sellingUnit: true,
                        availableQuantity: true,
                        pricePerUnit: true,
                    },
                },
            },
        });

        if (carts.length !== cartIds.length) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Some cart ids are invalid or do not belong to this user",
            );
        }

        const unavailableCart = carts.find(
            (cart) => cart.quantity > cart.product.availableQuantity,
        );

        if (unavailableCart) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                `Insufficient quantity available for ${unavailableCart.product.name}`,
            );
        }

        const items = carts.map((cart) => ({
            productId: cart.product.id,
            quantity: cart.quantity,
            productName: cart.product.name,
            sellingUnit: cart.product.sellingUnit,
            unitPrice: cart.product.pricePerUnit as number,
            subtotal: cart.quantity * (cart.product.pricePerUnit as number),
        }));

        const totalAmount =
            Math.round(
                items.reduce((total, item) => total + item.subtotal, 0) * 100,
            ) / 100;
        const orderId = generateOrderId();

        await this.prisma.$transaction(async (transaction) => {
            const order = await transaction.order.create({
                data: {
                    orderId,
                    customerId: user.id,
                    shippingAddressId: shippingAddress.id,
                    status: "Active",
                    totalAmount,
                    paymentStatus: "Paid",
                    items: {
                        create: items.map((item) => ({
                            ...item,
                            status: "Pending",
                        })),
                    },
                },
            });

            for (const item of items) {
                const result = await transaction.product.updateMany({
                    where: {
                        id: item.productId,
                        availableQuantity: {
                            gte: item.quantity,
                        },
                    },
                    data: {
                        availableQuantity: {
                            decrement: item.quantity,
                        },
                        sold: {
                            increment: item.quantity,
                        },
                    },
                });

                if (result.count === 0) {
                    throw new ApiError(
                        HttpStatus.BAD_REQUEST,
                        `Insufficient quantity available for ${item.productName}`,
                    );
                }
            }

            await transaction.cart.deleteMany({
                where: {
                    userId: user.id,
                    id: {
                        in: cartIds,
                    },
                },
            });

            return order;
        });

             return {
            message: "Order created successfully",
            orderId,
            checkoutSessionUrl: "https://res.cloudinary.com/dbpao5h91/image/upload/v1791863901/projects/jmqlhy3afcd1fnbvrccz.png",            
            transactionId : "transactionId",
        };
    }

    async createOrderWithCinetPay(user: UserPayload, payload: CreateOrderDto) {
        const shippingAddress =
            await this.prisma.shippingAddress.findUniqueOrThrow({
                where: {
                    id: payload.shippingAddressId,
                    userId: user.id,
                },
                select: {
                    id: true,
                    addressLine: true,
                    city: true,
                    postCode: true,
                },
            });

        const rawCartIds = payload.cartIds;

        const cartIds = Array.isArray(rawCartIds)
            ? Array.from(new Set(rawCartIds.filter(Boolean)))
            : [];

        if (cartIds.length === 0) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "At least one cart item is required to create an order",
            );
        }

        const carts = await this.prisma.cart.findMany({
            where: {
                userId: user.id,
                id: {
                    in: cartIds,
                },
            },
            select: {
                id: true,
                quantity: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        sellingUnit: true,
                        availableQuantity: true,
                        pricePerUnit: true,
                    },
                },
            },
        });

        if (carts.length !== cartIds.length) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Some cart ids are invalid or do not belong to this user",
            );
        }

        const unavailableCart = carts.find(
            (cart) => cart.quantity > cart.product.availableQuantity,
        );

        if (unavailableCart) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                `Insufficient quantity available for ${unavailableCart.product.name}`,
            );
        }

        const items = carts.map((cart) => ({
            productId: cart.product.id,
            quantity: cart.quantity,
            productName: cart.product.name,
            sellingUnit: cart.product.sellingUnit,
            unitPrice: cart.product.pricePerUnit as number,
            subtotal: cart.quantity * (cart.product.pricePerUnit as number),
        }));

        const totalAmount =
            Math.round(
                items.reduce((total, item) => total + item.subtotal, 0) * 100,
            ) / 100;

        const orderId = generateOrderId();
        const transactionId = `CP_${orderId}_${Date.now()}`;

        const order = await this.prisma.$transaction(async (transaction) => {
            const order = await transaction.order.create({
                data: {
                    orderId,
                    customerId: user.id,
                    shippingAddressId: shippingAddress.id,
                    status: "Pending",
                    totalAmount,
                    paymentStatus: "Pending",
                    cinetpayTransactionId: transactionId,
                    items: {
                        create: items.map((item) => ({
                            ...item,
                            status: "Pending",
                        })),
                    },
                },
            });

            return order;
        });

        const customer = await this.prisma.user.findUnique({
            where: { id: user.id },
            select: {
                fullName: true,
                email: true,
                buyerProfile: {
                    select: {
                        phoneNumber: true,
                        city: true,
                        address: true,
                    },
                },
            },
        });

        const [firstName, ...lastNameParts] = (
            customer?.fullName || "Valued Customer"
        )
            .trim()
            .split(" ");
        const lastName = lastNameParts.join(" ") || firstName;
        const customerPhone = customer?.buyerProfile?.phoneNumber || "00000000";

        const paymentResponse = await this.cinetpay.initiatePayment({
            transactionId,
            amount: totalAmount,
            currency: config.cinetpay.currency,
            description: `Payment for Order #${orderId}`,
            channels: config.cinetpay.channels,
            metadata: {
                orderId: order.id,
                orderCustomId: orderId,
                customerId: user.id,
            },
            customer: {
                id: user.id,
                name: firstName,
                surname: lastName,
                email: user.email,
                phoneNumber: customerPhone,
                address: shippingAddress.addressLine || "N/A",
                city: shippingAddress.city || "Abidjan",
                country: "CI",
                zipCode: shippingAddress.postCode || "00225",
            },
        });

        return {
            message: "Order created successfully",
            orderId,
            checkoutSessionUrl: paymentResponse.paymentUrl,            
            transactionId,
        };
    }

    async initiateCheckoutForOrder(user: UserPayload, orderId: string) {
        const order = await this.prisma.order.findFirst({
            where: {
                OR: [{ id: orderId }, { orderId }],
                customerId: user.id,
            },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                shippingAddress: true,
                customer: {
                    include: {
                        buyerProfile: true,
                    },
                },
            },
        });

        if (!order) {
            throw new ApiError(HttpStatus.NOT_FOUND, "Order not found");
        }

        if (order.paymentStatus === "Paid") {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "This order has already been paid",
            );
        }

        if (order.status === "Cancelled") {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Cancelled orders cannot be paid",
            );
        }

        for (const item of order.items) {
            if (item.quantity > item.product.availableQuantity) {
                throw new ApiError(
                    HttpStatus.BAD_REQUEST,
                    `Insufficient stock available for ${item.productName}`,
                );
            }
        }

        const transactionId = `CP_${order.orderId}_${Date.now()}`;

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                cinetpayTransactionId: transactionId,
            },
        });

        const [firstName, ...lastNameParts] = (
            order.customer.fullName || "Valued Customer"
        )
            .trim()
            .split(" ");
        const lastName = lastNameParts.join(" ") || firstName;
        const customerPhone =
            order.customer.buyerProfile?.phoneNumber || "00000000";

        const paymentResponse = await this.cinetpay.initiatePayment({
            transactionId,
            amount: order.totalAmount,
            currency: config.cinetpay.currency,
            description: `Payment for Order #${order.orderId}`,
            channels: config.cinetpay.channels,
            metadata: {
                orderId: order.id,
                orderCustomId: order.orderId,
                customerId: user.id,
            },
            customer: {
                id: user.id,
                name: firstName,
                surname: lastName,
                email: user.email,
                phoneNumber: customerPhone,
                address: order.shippingAddress.addressLine || "N/A",
                city: order.shippingAddress.city || "Abidjan",
                country: "CI",
                zipCode: order.shippingAddress.postCode || "00225",
            },
        });

        return {
            message: "Checkout session generated successfully",
            orderId: order.orderId,
            checkoutSessionUrl: paymentResponse.paymentUrl,
            paymentUrl: paymentResponse.paymentUrl,
            transactionId,
        };
    }

    async getUserOrders(user: UserPayload, query?: OrderQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.order, query);

        const response = queryBuilder
            .search(["orderId"])
            .filter({
                exacts: ["status", "paymentStatus"],
            })
            .rawFilter({
                customerId: user.id,
            })
            .sortBy({
                createdAt: "desc",
            })
            .paginate()
            .select({
                id: true,
                orderId: true,
                status: true,
                paymentStatus: true,
                totalAmount: true,
                createdAt: true,
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
                                    },
                                },
                            },
                        },
                    },
                },
            });

        const [orders, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            message: "Orders fetched successfully",
            data: {
                orders,
                meta: pagination,
            },
        };
    }

    async getProducerWiseOrders(user: UserPayload, query?: OrderQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.orderItem, query);

        const response = queryBuilder
            .search(["productName"])
            .rawFilter({
                product: {
                    producerId: user.id,
                },
                order: {
                    paymentStatus: "Paid",
                },
            })
            .select({
                id: true,
                productName: true,
                createdAt: true,
                sellingUnit: true,
                quantity: true,
                subtotal: true,
                unitPrice: true,
                product: {
                    select: {
                        imageUrls: true,
                    },
                },
                order: {
                    select: {
                        orderId: true,
                        customer: {
                            select: {
                                fullName: true,
                                profileImage: true,
                                buyerProfile: {
                                    select: {
                                        institution: true,
                                    },
                                },
                            },
                        },
                    },
                },
            });

        const [orderItems, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            message: "Orders fetched successfully",
            data: {
                orderItems,
                meta: pagination,
            },
        };
    }

    async getOrderById(user: UserPayload, orderId: string) {
        const order = await this.prisma.order.findUniqueOrThrow({
            where: {
                id: orderId,
                customerId: user.id,
            },
            select: {
                id: true,
                orderId: true,
                status: true,
                paymentStatus: true,
                totalAmount: true,
                cancelReason: true,
                shippingAddress: {
                    select: {
                        addressLine: true,
                        city: true,
                        instruction: true,
                        postCode: true,
                    },
                },
                createdAt: true,
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
            },
        });
        return {
            message: "Order fetched successfully",
            data: order,
        };
    }

    async markDeliveryAsPickedUpOrCanceled(
        payload: DeliveryDto,
        user: UserPayload,
    ) {
        await this.prisma.delivery.findUniqueOrThrow({
            where: {
                id: payload.deliveryId,
                driverId: user.id,
                status: "Assigned",
            },
            select: {
                id: true,
            },
        });

        if (payload.status === "PickedUp") {
            await this.prisma.delivery.update({
                where: {
                    id: payload.deliveryId,
                },
                data: {
                    status: "PickedUp",
                },
            });

            return {
                message: "Delivery marked as picked up successfully",
            };
        } else if (payload.status === "Cancelled") {
            await this.prisma.delivery.delete({
                where: {
                    id: payload.deliveryId,
                },
            });

            return {
                message: "Delivery cancelled successfully",
            };
        }
    }

    async sendDeliveryCompletionOtp(deliveryId: string, user: UserPayload) {
        const delivery = await this.prisma.delivery.findUniqueOrThrow({
            where: {
                id: deliveryId,
                driverId: user.id,
                status: "PickedUp",
            },
            select: {
                id: true,
                order: {
                    select: {
                        orderId: true,
                        customer: {
                            select: {
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        const { otp } = generateOTP();

        const hashedOtp: string = await this.bcryptService.hash(
            otp,
            config.password.salt,
        );

        const html = emailBodyForDeliveryCompletion(
            delivery.order.orderId,
            otp,
        );
        await sendEmail(
            delivery.order.customer.email,
            `Your OTP for Delivery Completion - Order ${delivery.order.orderId}`,
            html,
        );

        await this.prisma.delivery.update({
            where: {
                id: deliveryId,
            },
            data: {
                otpHash: hashedOtp,
            },
        });

        return {
            message: "OTP sent to customer successfully",
        };
    }

    async verifyDeliveryCompletionOtp(
        payload: ConfirmDeliveryDto,
        user: UserPayload,
    ) {
        const delivery = await this.prisma.delivery.findUniqueOrThrow({
            where: {
                id: payload.deliveryId,
                driverId: user.id,
                status: "PickedUp",
            },
            select: {
                id: true,
                otpHash: true,
                order: {
                    select: {
                        id: true,
                        status: true,
                        paymentStatus: true,
                        items: {
                            select: {
                                id: true,
                                subtotal: true,
                                product: {
                                    select: {
                                        producerId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const otpMatched = await this.bcryptService.compare(
            payload.otp,
            delivery.otpHash as string,
        );

        if (!otpMatched) {
            throw new ApiError(HttpStatus.FORBIDDEN, "Incorrect OTP");
        }

        await this.prisma.$transaction(async (transaction) => {
            await transaction.delivery.update({
                where: {
                    id: payload.deliveryId,
                },
                data: {
                    status: "Delivered",
                },
            });

            await transaction.driverProfile.update({
                where: {
                    userId: user.id,
                },
                data: {
                    isAvailable: true,
                },
            });

            await transaction.order.update({
                where: {
                    id: delivery.order.id,
                    status: "Active",
                },
                data: {
                    status: "Delivered",
                },
            });

            for (const item of delivery.order.items) {
                await transaction.orderItem.update({
                    where: {
                        id: item.id,
                    },
                    data: {
                        status: "Delivered",
                    },
                });
                await transaction.producerProfile.update({
                    where: {
                        userId: item.product.producerId,
                    },
                    data: {
                        allTimeEarnings: {
                            increment: item.subtotal * 0.9, // Assuming 10% platform fee
                        },
                        currentEarnings: {
                            increment: item.subtotal * 0.9, // Assuming 10% platform fee
                        },
                    },
                });
            }

            await transaction.driverProfile.update({
                where: {
                    userId: user.id,
                },
                data: {
                    allTimeEarnings: {
                        increment: 50,
                    },
                    currentEarnings: {
                        increment: 50,
                    },
                },
            });
        });

        return {
            message: "Delivery marked as completed successfully",
        };
    }

    // --- CinetPay Webhook and Payment Verification Handlers ---

    async handleCinetPayWebhook(payload: Record<string, unknown>) {
        this.logger.log(
            `Received CinetPay notification payload: ${JSON.stringify(payload)}`,
        );

        const rawTxId =
            payload?.cpm_trans_id ||
            payload?.transaction_id ||
            payload?.trans_id;

        const transactionId =
            typeof rawTxId === "string"
                ? rawTxId
                : typeof rawTxId === "number"
                  ? String(rawTxId)
                  : undefined;

        if (!transactionId || typeof transactionId !== "string") {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Missing transaction ID in CinetPay notification",
            );
        }

        const result = await this.verifyAndProcessOrderPayment(transactionId);
        return {
            received: true,
            message: "CinetPay notification processed successfully",
            data: result,
        };
    }

    async verifyPayment(user: UserPayload, transactionId: string) {
        const order = await this.prisma.order.findFirst({
            where: {
                OR: [
                    { cinetpayTransactionId: transactionId },
                    { orderId: transactionId },
                    { id: transactionId },
                ],
                customerId: user.id,
            },
        });

        if (!order) {
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                "Order associated with this transaction was not found",
            );
        }

        const targetTxId = order.cinetpayTransactionId || transactionId;
        const result = await this.verifyAndProcessOrderPayment(targetTxId);

        return {
            message: "Payment status verified successfully",
            data: result,
        };
    }

    async verifyAndProcessOrderPayment(transactionId: string) {
        // Step 1: Query CinetPay server-to-server check API
        const checkResult =
            await this.cinetpay.checkTransactionStatus(transactionId);

        // Step 2: Locate order
        let order = await this.prisma.order.findFirst({
            where: { cinetpayTransactionId: transactionId },
            include: { items: true },
        });

        const metadataOrderId =
            typeof checkResult.metadata?.orderId === "string"
                ? checkResult.metadata.orderId
                : undefined;

        if (!order && metadataOrderId) {
            order = await this.prisma.order.findUnique({
                where: { id: metadataOrderId },
                include: { items: true },
            });
        }

        if (!order) {
            this.logger.error(
                `No order matches transaction ID: ${transactionId}`,
            );
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                `Order not found for transaction ${transactionId}`,
            );
        }

        // Step 3: Handle Idempotency - if already paid, return early
        if (order.paymentStatus === "Paid") {
            this.logger.log(
                `Order ${order.orderId} is already marked as Paid. Skipping re-processing.`,
            );
            return {
                orderId: order.orderId,
                status: order.status,
                paymentStatus: order.paymentStatus,
                isPaid: true,
            };
        }

        // Step 4: Handle successful payment (ACCEPTED)
        if (checkResult.isSuccess) {
            // Validate amount and currency
            if (checkResult.amount !== undefined) {
                const expectedAmount = Math.round(order.totalAmount);
                const actualAmount = Math.round(Number(checkResult.amount));
                if (Math.abs(expectedAmount - actualAmount) > 1) {
                    this.logger.error(
                        `Amount mismatch for order ${order.orderId}: expected ${expectedAmount}, received ${actualAmount}`,
                    );
                    throw new ApiError(
                        HttpStatus.BAD_REQUEST,
                        "Payment verification failed: Amount mismatch",
                    );
                }
            }

            if (checkResult.currency && config.cinetpay.currency) {
                if (
                    checkResult.currency.toUpperCase() !==
                    config.cinetpay.currency.toUpperCase()
                ) {
                    this.logger.error(
                        `Currency mismatch for order ${order.orderId}: expected ${config.cinetpay.currency}, received ${checkResult.currency}`,
                    );
                    throw new ApiError(
                        HttpStatus.BAD_REQUEST,
                        "Payment verification failed: Currency mismatch",
                    );
                }
            }

            try {
                await this.prisma.$transaction(async (transaction) => {
                    // Double check concurrency inside atomic transaction
                    const currentOrder = await transaction.order.findUnique({
                        where: { id: order.id },
                    });

                    if (
                        !currentOrder ||
                        currentOrder.paymentStatus === "Paid" ||
                        currentOrder.paymentStatus === "Refunded"
                    ) {
                        return;
                    }

                    await transaction.order.update({
                        where: { id: order.id },
                        data: {
                            status: "Active",
                            paymentStatus: "Paid",
                            cinetpayTransactionId: transactionId,
                        },
                    });

                    for (const item of order.items) {
                        const result = await transaction.product.updateMany({
                            where: {
                                id: item.productId,
                                availableQuantity: {
                                    gte: item.quantity,
                                },
                            },
                            data: {
                                availableQuantity: {
                                    decrement: item.quantity,
                                },
                                sold: {
                                    increment: item.quantity,
                                },
                            },
                        });

                        if (result.count === 0) {
                            throw new ApiError(
                                HttpStatus.BAD_REQUEST,
                                `Insufficient quantity available for ${item.productName}`,
                            );
                        }
                    }

                    await transaction.cart.deleteMany({
                        where: {
                            userId: order.customerId,
                            productId: {
                                in: order.items.map((item) => item.productId),
                            },
                        },
                    });
                });

                this.logger.log(
                    `Order ${order.orderId} successfully marked as Paid.`,
                );

                return {
                    orderId: order.orderId,
                    status: "Active",
                    paymentStatus: "Paid",
                    isPaid: true,
                };
            } catch (processingError: unknown) {
                const errorMessage =
                    processingError instanceof Error
                        ? processingError.message
                        : "Unknown fulfillment error";

                this.logger.error(
                    `Error during post-payment fulfillment for order ${order.orderId}: ${errorMessage}`,
                );

                await this.prisma.order.updateMany({
                    where: { id: order.id },
                    data: {
                        status: "Cancelled",
                        paymentStatus: "Failed",
                        cancelReason: `Order fulfillment failed after payment: ${errorMessage}`,
                    },
                });

                throw processingError;
            }
        }

        // Step 5: Handle failed or rejected payment
        if (checkResult.isFailed) {
            this.logger.warn(
                `CinetPay transaction ${transactionId} for order ${order.orderId} was rejected or cancelled (${checkResult.message}).`,
            );

            await this.prisma.order.updateMany({
                where: {
                    id: order.id,
                    paymentStatus: "Pending",
                },
                data: {
                    status: "Cancelled",
                    paymentStatus: "Failed",
                    cancelReason: `Payment rejected by CinetPay: ${checkResult.message || "Failed"}`,
                },
            });

            return {
                orderId: order.orderId,
                status: "Cancelled",
                paymentStatus: "Failed",
                isPaid: false,
            };
        }

        // Step 6: Pending or unknown status
        return {
            orderId: order.orderId,
            status: order.status,
            paymentStatus: order.paymentStatus,
            isPaid: false,
            message: `Transaction status is ${checkResult.status}`,
        };
    }
}
