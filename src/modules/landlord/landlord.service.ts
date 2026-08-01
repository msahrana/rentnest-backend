import { RentalRequestStatus, Role } from '../../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { ICreateProperty } from './landlord.interface';

const createPropertyIntoDB = async (
    payload: ICreateProperty,
    landlordId: string,
) => {
    console.log('LANDLORD ID:', landlordId);

    console.log('PROPERTY PAYLOAD:', payload);
    // Check landlord
    const landlord = await prisma.user.findUnique({
        where: {
            id: landlordId,
        },
    });

    if (!landlord) {
        throw new Error('Landlord not found.');
    }

    if (landlord.role !== Role.LANDLORD) {
        throw new Error('Only landlords can create properties.');
    }

    // Check category
    const category = await prisma.category.findUnique({
        where: {
            id: payload.categoryId,
        },
    });

    if (!category) {
        throw new Error('Category not found.');
    }

    const result = await prisma.property.create({
        data: {
            title: payload.title,
            description: payload.description,
            location: payload.location,
            address: payload.address,
            rent: Number(payload.rent),
            bedrooms: Number(payload.bedrooms),
            bathrooms: Number(payload.bathrooms),
            area: payload.area ? Number(payload.area) : null,
            propertyType: payload.propertyType,
            amenities: payload.amenities,
            thumbnail: payload.thumbnail,
            images: payload.images,
            landlordId,
            categoryId: payload.categoryId,
        },
        include: {
            landlord: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            category: true,
        },
    });

    return result;
};

const getAllPropertiesIntoDB = async (landlordId: string) => {
    return prisma.property.findMany({
        include: {
            landlord: true,
            category: true,
        },
    });
};

const getAllRentalRequestsFromDB = async (landlordId: string) => {
    const landlord = await prisma.user.findUnique({
        where: {
            id: landlordId,
        },
    });

    if (!landlord) {
        throw new Error('Landlord not found.');
    }

    const requests = await prisma.rentalRequest.findMany({
        where: {
            property: {
                landlordId,
            },
        },
        include: {
            tenant: {
                include: {
                    profile: true,
                },
            },
            property: {
                include: {
                    category: true,
                },
            },
            payment: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return requests;
};

const getSinglePropertyIntoDB = async (id: string) => {
    const property = await prisma.property.findUnique({
        where: {
            id,
        },
        include: {
            landlord: true,
            category: true,
            reviews: true,
        },
    });

    if (!property) {
        throw new Error('Property not found.');
    }

    return property;
};

const updatePropertyIntoDB = async (
    id: string,
    payload: any,
    landlordId: string,
) => {
    const property = await prisma.property.findUnique({
        where: {
            id,
        },
    });

    if (!property) {
        throw new Error('Property not found.');
    }

    if (property.landlordId !== landlordId) {
        throw new Error('Unauthorized');
    }

    const updateData = {
        title: payload.title,

        description: payload.description,

        location: payload.location,

        address: payload.address,

        rent: Number(payload.rent),

        bedrooms: Number(payload.bedrooms),

        bathrooms: Number(payload.bathrooms),

        area: Number(payload.area),

        propertyType: payload.propertyType,

        categoryId: payload.categoryId,

        amenities: payload.amenities,

        thumbnail: payload.thumbnail,

        images: payload.images,
    };

    return prisma.property.update({
        where: {
            id,
        },

        data: updateData,
    });
};

const deletePropertyIntoDB = async (id: string, landlordId: string) => {
    const property = await prisma.property.findUnique({
        where: {
            id,
        },
    });

    if (!property) {
        throw new Error('Property not found.');
    }

    if (property.landlordId !== landlordId) {
        throw new Error('Unauthorized');
    }

    return prisma.property.delete({
        where: {
            id,
        },
    });
};

const updateRentalRequestStatusIntoDB = async (
    rentalId: string,
    landlordId: string,
    payload: { status: RentalRequestStatus },
) => {
    const rental = await prisma.rentalRequest.findUnique({
        where: {
            id: rentalId,
        },
        include: {
            property: true,
        },
    });

    if (!rental) {
        throw new Error('Rental request not found.');
    }

    // Check property owner
    if (rental.property.landlordId !== landlordId) {
        throw new Error('Unauthorized.');
    }

    // Already processed
    if (rental.status !== RentalRequestStatus.PENDING) {
        throw new Error('Rental request has already been processed.');
    }

    // Only APPROVED or REJECTED
    if (
        payload.status !== RentalRequestStatus.APPROVED &&
        payload.status !== RentalRequestStatus.REJECTED
    ) {
        throw new Error('Invalid rental status.');
    }

    const result = await prisma.rentalRequest.update({
        where: {
            id: rentalId,
        },
        data: {
            status: payload.status,
        },
        include: {
            tenant: true,
            property: true,
        },
    });

    return result;
};

export const landlordService = {
    createPropertyIntoDB,
    getAllPropertiesIntoDB,
    getAllRentalRequestsFromDB,
    getSinglePropertyIntoDB,
    updatePropertyIntoDB,
    deletePropertyIntoDB,
    updateRentalRequestStatusIntoDB,
};
