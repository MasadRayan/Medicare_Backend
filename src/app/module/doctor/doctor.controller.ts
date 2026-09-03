import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const resume = files?.['resume']?files['resume'][0] : null;
    const additionalFiles = files?.['additionalFiles'] || [];
    const data = req.body.data;
    console.log(resume, additionalFiles, data);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: null
	});
});


export const DoctorController = {
    applyAsDoctor,
};