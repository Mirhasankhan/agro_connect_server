import { UserPayload } from "@/common/guards/auth.guard";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { StripeService } from "@/core/services/stripe/stripe.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import { CreateOrderDto } from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import Stripe from "stripe";

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
                                pricePerUnit: true,
                                quantity: true,
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
                            ...item,
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
