import { UserPayload } from "@/common/guards/auth.guard";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { StripeService } from "@/core/services/stripe/stripe.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import { CreateOrderDto, OrderQueryDto } from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import Stripe from "stripe";
import QueryBuilder from "@/common/utils/queryBuilder";

@Injectable()
export class OrderService {
    constructor(
        private prisma: PrismaService,
        private stripe: StripeService,
    ) {}

    async createOrder(user: UserPayload, payload: CreateOrderDto) {
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
                        pricingTiers: {
                            select: {
                                quantity: true,
                                pricePerUnit: true,
                            },
                            orderBy: {
                                quantity: "asc",
                            },
                        },
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

        const items = carts.map((cart) => {
            const basePrice = cart.product.pricePerUnit as number;       
            const applicableTier = cart.product.pricingTiers
                .filter((tier) => tier.quantity <= cart.quantity)
                .sort((a, b) => b.quantity - a.quantity)[0];

            const unitPrice = applicableTier
                ? (applicableTier.pricePerUnit as number)
                : basePrice;

            const subtotal = cart.quantity * unitPrice;

            return {
                productId: cart.product.id,
                quantity: cart.quantity,
                productName: cart.product.name,
                sellingUnit: cart.product.sellingUnit,
                unitPrice,
                subtotal,
            };
        });

        const totalAmount =
            Math.round(
                items.reduce((total, item) => total + item.subtotal, 0) * 100,
            ) / 100;

        const generateOrderId = () => {
            const code = Math.floor(100000 + Math.random() * 900000);

            return `AC-${code}`;
        };

        const orderId = generateOrderId();

        const order = await this.prisma.$transaction(async (transaction) => {
            const order = await transaction.order.create({
                data: {
                    orderId,
                    customerId: user.id,
                    shippingAddressId: shippingAddress.id,
                    status: "Pending",
                    totalAmount,
                    paymentStatus: "Pending",

                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            productName: item.productName,
                            sellingUnit: item.sellingUnit,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            subtotal: item.subtotal,
                            status: "Pending",
                        })),
                    },
                },
            });

            return order;
        });

        const checkoutSession = await this.stripe.createCheckoutSession({
            line_items: items.map((item) => ({
                price_data: {
                    currency: "usd",

                    product_data: {
                        name: item.productName,
                        description: `Sold by ${item.sellingUnit}`,
                    },

                    unit_amount: Math.round(item.unitPrice * 100),
                },

                quantity: item.quantity,
            })),

            client: {
                id: user.id,
                email: user.email,
            },

            metadata: {
                orderId: order.id,
                customerId: user.id,
            },
        });

        return {
            message: "Order created successfully",
            orderId,
            checkoutSessionUrl: checkoutSession.url,
        };
    }

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
    //                     pricingTiers: {
    //                         select: {
    //                             pricePerUnit: true,
    //                             quantity: true,
    //                         },
    //                     },
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

    //     const generateOrderId = () => {
    //         const code = Math.floor(100000 + Math.random() * 900000);

    //         return `AC-${code}`;
    //     };

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
            })
            .select({
                id: true,
                productName: true,
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
                        country: true,
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
                                                district: true,
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

    //stripe webhook handler

    async handleStripeWebhook(
        payload: string | Buffer<ArrayBufferLike>,
        signature: string,
    ) {
        console.log("Came here:", payload.toString());
        const event = await this.stripe.constructEvent(payload, signature);

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;

                if (session.payment_status === "paid") {
                    await this.markOrderAsPaid(session);
                }
                break;
            }
            case "checkout.session.async_payment_succeeded":
                await this.markOrderAsPaid(
                    event.data.object as Stripe.Checkout.Session,
                );
                break;
            case "checkout.session.async_payment_failed":
            case "checkout.session.expired":
                await this.markOrderAsFailed(
                    event.data.object as Stripe.Checkout.Session,
                );
                break;
            default:
                break;
        }

        return { received: true };
    }

    private async markOrderAsPaid(session: Stripe.Checkout.Session) {
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Stripe checkout session is missing order metadata",
            );
        }

        const paymentIntentId =
            typeof session.payment_intent === "string"
                ? session.payment_intent
                : undefined;

        try {
            await this.prisma.$transaction(async (transaction) => {
                const order = await transaction.order.findUnique({
                    where: { id: orderId },
                    include: { items: true },
                });

                if (
                    !order ||
                    order.paymentStatus === "Paid" ||
                    order.paymentStatus === "Refunded" ||
                    order.paymentStatus === "Failed"
                ) {
                    return;
                }

                await transaction.order.update({
                    where: { id: order.id },
                    data: {
                        status: "Active",
                        paymentStatus: "Paid",
                        ...(paymentIntentId
                            ? { stripePaymentIntentId: paymentIntentId }
                            : {}),
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
        } catch (processingError) {
            if (!paymentIntentId) {
                await this.prisma.order.updateMany({
                    where: { id: orderId },
                    data: {
                        status: "Cancelled",
                        paymentStatus: "Failed",
                        cancelReason: "Payment processing failed",
                    },
                });

                throw processingError;
            }

            try {
                await this.stripe.refundPaymentIntent(
                    paymentIntentId,
                    `order-refund-${orderId}`,
                );

                await this.prisma.$transaction([
                    this.prisma.order.update({
                        where: { id: orderId },
                        data: {
                            status: "Refunded",
                            paymentStatus: "Refunded",
                            stripePaymentIntentId: paymentIntentId,
                            cancelReason:
                                "Payment refunded because order processing failed",
                        },
                    }),
                    this.prisma.orderItem.updateMany({
                        where: { orderId },
                        data: { status: "Refunded" },
                    }),
                ]);
            } catch (refundError) {
                await this.prisma.order.updateMany({
                    where: { id: orderId },
                    data: {
                        status: "Cancelled",
                        paymentStatus: "Failed",
                        stripePaymentIntentId: paymentIntentId,
                        cancelReason: "Payment refund failed",
                    },
                });

                throw refundError;
            }
        }
    }

    private async markOrderAsFailed(session: Stripe.Checkout.Session) {
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            return;
        }

        await this.prisma.order.updateMany({
            where: {
                id: orderId,
                paymentStatus: "Pending",
            },
            data: {
                status: "Cancelled",
                paymentStatus: "Failed",
            },
        });
    }
}
