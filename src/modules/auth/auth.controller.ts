import { NextFunction, Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { catchAsync } from '../../utils/catchAsync';
import { authService } from './auth.service';
import HttpStatus from 'http-status';

const registerUser = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const payload = req.body;

        const user = await authService.registerUserIntoDB(payload);

        sendResponse(res, {
            success: true,
            statusCode: HttpStatus.CREATED,
            message: 'User Created Successfully!',
            data: { user },
        });
    },
);

const loginUser = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const payload = req.body;

        const { accessToken, refreshToken } =
            await authService.loginUserIntoDB(payload);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'none',
            maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'none',
            maxAge: 1000 * 60 * 60 * 24 * 30, // 1 month or 30 day
        });

        sendResponse(res, {
            success: true,
            statusCode: HttpStatus.OK,
            message: 'User login successfully!',
            data: { accessToken, refreshToken },
        });
    },
);

const refreshToken = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const refreshToken = req.cookies.refreshToken;

        const { accessToken } =
            await authService.refreshTokenIntoDB(refreshToken);
        res.cookie('newAccessToken', accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'none',
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year or 365 day
        });

        sendResponse(res, {
            success: true,
            statusCode: HttpStatus.OK,
            message: 'Token refreshed is done',
            data: { accessToken },
        });
    },
);

const getMyProfile = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const profile = await authService.getMyProfileIntoDB(
            req.user?.id as string,
        );

        sendResponse(res, {
            success: true,
            statusCode: HttpStatus.OK,
            message: 'User profile fetched successfully',
            data: { profile },
        });
    },
);

const updateMyProfile = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        console.log('USER:', req.user);

        console.log('BODY:', req.body);
        const userId = req?.user?.id as string;
        const payload = req.body;

        const updatedProfile = await authService.updateMyProfileIntoDB(
            userId,
            payload,
        );

        sendResponse(res, {
            success: true,
            statusCode: HttpStatus.OK,
            message: 'User profile updated successfully!',
            data: { updatedProfile },
        });
    },
);

const changePassword = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    const user = await authService.changePasswordIntoDB(userId, req.body);

    sendResponse(res, {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Password changed successfully.',
        data: user,
    });
});

export const authController = {
    registerUser,
    loginUser,
    refreshToken,
    getMyProfile,
    updateMyProfile,
    changePassword,
};
