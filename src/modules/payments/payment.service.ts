import { prisma } from '../../lib/prisma';
import { stripe } from '../../lib/stripe';
import config from '../../config';
import Stripe from 'stripe';
import {
    PaymentMethod,
    PaymentStatus,
    RentalRequestStatus,
    Role,
} from '../../../generated/prisma/enums';

const createCheckoutSessionIntoDB = async (rentalRequestId: string) => {
    const rentalRequest = await prisma.rentalRequest.findUniqueOrThrow({
        where: {
            id: rentalRequestId,
        },
        include: {
            tenant: true,
            property: true,
            payment: true,
        },
    });

    if (rentalRequest.status !== RentalRequestStatus.APPROVED) {
        throw new Error('Only approved rental requests can be paid.');
    }

    let stripeCustomerId = rentalRequest.payment?.stripeCustomerId;

    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
            email: rentalRequest.tenant.email,
            name: rentalRequest.tenant.name,
            metadata: {
                userId: rentalRequest.tenant.id,
                rentalRequestId: rentalRequest.id,
            },
        });

        stripeCustomerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: stripeCustomerId,
        payment_method_types: ['card'],

        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: rentalRequest.property.title,
                        description: rentalRequest.property.location,
                    },
                    unit_amount: Math.round(rentalRequest.property.rent * 100),
                },
                quantity: 1,
            },
        ],

        // success_url: `${config.APP_URL}/payment-success`,
        // cancel_url: `${config.APP_URL}/payment-cancel`,

        success_url: `${config.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.APP_URL}/payment/cancel`,

        metadata: {
            rentalRequestId: rentalRequest.id,
            userId: rentalRequest.tenant.id,
        },
    });

    return {
        paymentUrl: session.url,
    };
};

const handleWebhookIntoDB = async (payload: Buffer, signature: string) => {
    const endpointSecret = config.STRIPE_WEBHOOK_SECRET;
    const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        endpointSecret,
    );

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            console.log(event.data.object);
            const session: Stripe.Checkout.Session = event.data.object;
            const userId = session.metadata?.userId;
            const rentalRequestId = session.metadata?.rentalRequestId;
            const stripeCustomerId = session.customer as string;

            const paymentIntentId = session.payment_intent as string;

            if (
                !userId ||
                !rentalRequestId ||
                !paymentIntentId ||
                !stripeCustomerId
            ) {
                console.log(
                    'Webhook : Missing values For Creating Checkout Session',
                );
                return;
            }

            const paymentIntent =
                await stripe.paymentIntents.retrieve(paymentIntentId);
            console.log(paymentIntent);

            await prisma.payment.upsert({
                where: {
                    rentalRequestId,
                },
                update: {
                    transactionId: paymentIntent.id,
                    amount: paymentIntent.amount_received / 100,
                    method: PaymentMethod.STRIPE,
                    provider: 'STRIPE',
                    status: PaymentStatus.COMPLETED,
                    paidAt: new Date(),
                    stripeCustomerId,
                    currentPeriodEnd: new Date(),
                },
                create: {
                    rentalRequestId,
                    userId,
                    transactionId: paymentIntent.id,
                    amount: paymentIntent.amount_received / 100,
                    method: PaymentMethod.STRIPE,
                    provider: 'STRIPE',
                    status: PaymentStatus.COMPLETED,
                    paidAt: new Date(),
                    stripeCustomerId,
                    currentPeriodEnd: new Date(),
                },
            });

            await prisma.rentalRequest.updateMany({
                where: {
                    id: rentalRequestId,
                },

                data: {
                    status: RentalRequestStatus.COMPLETED,
                },
            });

            break;

        case 'customer.subscription.updated':
            break;

        case 'customer.subscription.deleted':
            break;

        default:
            console.log(`No event matched. Unhandled event type ${event.type}`);
            break;
    }
};

const getMyPaymentHistoryIntoDB = async (userId: string) => {
    const payments = await prisma.payment.findMany({
        where: {
            userId,
        },
        include: {
            rentalRequest: {
                include: {
                    property: {
                        select: {
                            id: true,
                            title: true,
                            location: true,
                            rent: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return payments;
};

const getSinglePaymentDataIntoDB = async (
    paymentId: string,
    userId: string,
    role: Role,
) => {
    const payment = await prisma.payment.findUniqueOrThrow({
        where: {
            id: paymentId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            rentalRequest: {
                include: {
                    property: {
                        select: {
                            id: true,
                            title: true,
                            location: true,
                            rent: true,
                            bedrooms: true,
                            bathrooms: true,
                        },
                    },
                },
            },
        },
    });

    if (role !== Role.ADMIN && payment.userId !== userId) {
        throw new Error('You are not authorized to view this payment.');
    }

    return payment;
};

export const paymentService = {
    createCheckoutSessionIntoDB,
    handleWebhookIntoDB,
    getMyPaymentHistoryIntoDB,
    getSinglePaymentDataIntoDB,
};
