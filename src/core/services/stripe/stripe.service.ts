import config from "@/config";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

@Injectable()
export class StripeService {
    private stripe: Stripe;

    constructor(private prisma: PrismaService) {
        this.stripe = new Stripe(config.stripe.secret_key, {
            apiVersion: "2025-08-27.basil", // Use the latest API version
        });
    }

    async createPaymentIntent({
        userId,
        paymentMethodId,
        amount,
    }: {
        userId: string;
        paymentMethodId: string;
        amount: number;
    }) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: {
                id: userId,
            },
            select: {
                fullName: true,
                email: true,
                stripeCustomerId: true,
            },
        });

        let customerId = user.stripeCustomerId;

        if (!customerId) {
            const customer = await this.stripe.customers.create({
                name: user.fullName,
                email: user.email,
            });

            customerId = customer.id;

            await this.prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    stripeCustomerId: customerId,
                },
            });
        }

        await this.stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });

        return await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: "usd",
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: "never",
            },
        });
    }

    async createCheckoutSession({
        line_items,
        client,
        metadata,
    }: {
        line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
        client: {
            id: string;
            email: string;
        };
        metadata: Stripe.MetadataParam;
    }) {
        return this.stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [...line_items],
            mode: "payment",
            allow_promotion_codes: true,
            success_url: config.url.payment_success,
            cancel_url: config.url.payment_success,
            client_reference_id: client.id,
            customer_email: client.email,
            metadata: { ...metadata },
            payment_intent_data: {
                metadata: { ...metadata },
            },
        });
    }

    async createCharge(data: Stripe.ChargeCreateParams) {
        return await this.stripe.charges.create(data);
    }

    async retrieveCharge(id: string) {
        return await this.stripe.charges.retrieve(id);
    }

    async refundPaymentIntent(paymentIntentId: string, idempotencyKey: string) {
        return await this.stripe.refunds.create(
            { payment_intent: paymentIntentId },
            { idempotencyKey },
        );
    }
    

    async constructEvent(
        payload: string | Buffer<ArrayBufferLike>,
        sig: string,
    ): Promise<Stripe.Event> {
        const webhookSecret = config.stripe.webhook_secret;

        // console.log(sig, webhookSecret);

        return this.stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    }
}
