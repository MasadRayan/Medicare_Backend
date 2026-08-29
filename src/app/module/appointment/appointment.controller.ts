import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message:
			"Email verification OTP sent successfully. Please check your email.",
		data: null,
	});
});

export const AppointmentController = {
	bookAppointment,
};
