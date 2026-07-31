import { RentalRequestStatus } from '../../../generated/prisma/enums';
import { ICreateReview } from './review.interface';
import { prisma } from '../../lib/prisma';

const createReviewIntoDB = async (payload: ICreateReview, tenantId: string) => {
    // Check property
    const property = await prisma.property.findUnique({
        where: {
            id: payload.propertyId,
        },
    });

    if (!property) {
        throw new Error('Property not found.');
    }

    // Check completed rental
    const rental = await prisma.rentalRequest.findFirst({
        where: {
            tenantId,
            propertyId: payload.propertyId,
            status: RentalRequestStatus.APPROVED,
        },
    });

    if (!rental) {
        throw new Error(
            'You can only review a property after completing the rental.',
        );
    }

    // Prevent duplicate reviews
    const existingReview = await prisma.review.findFirst({
        where: {
            tenantId,
            propertyId: payload.propertyId,
        },
    });

    if (existingReview) {
        throw new Error('You have already reviewed this property.');
    }

    const review = await prisma.review.create({
        data: {
            tenantId,
            propertyId: payload.propertyId,
            rating: payload.rating,
            comment: payload.comment,
        },
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            property: {
                select: {
                    id: true,
                    title: true,
                    location: true,
                },
            },
        },
    });

    return review;
};

const getMyReviewsFromDB = async (tenantId: string) => {
    const reviews = await prisma.review.findMany({
        where: {
            tenantId,
        },

        include: {
            property: {
                select: {
                    id: true,

                    title: true,

                    location: true,
                },
            },
        },

        orderBy: {
            createdAt: 'desc',
        },
    });

    return reviews;
};

export const reviewService = {
    createReviewIntoDB,
    getMyReviewsFromDB,
};
