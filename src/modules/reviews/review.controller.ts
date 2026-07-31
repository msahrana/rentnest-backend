import { sendResponse } from '../../utils/sendResponse';
import { catchAsync } from '../../utils/catchAsync';
import { reviewService } from './review.service';
import { Request, Response } from 'express';
import httpStatus from 'http-status';

const createReview = catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user!.id;

    const result = await reviewService.createReviewIntoDB(req.body, tenantId);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: 'Review created successfully.',
        data: result,
    });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user!.id;

    const result = await reviewService.getMyReviewsFromDB(tenantId);

    sendResponse(res, {
        success: true,

        statusCode: httpStatus.OK,

        message: 'My reviews retrieved successfully.',

        data: result,
    });
});

export const reviewController = {
    createReview,
    getMyReviews,
};
