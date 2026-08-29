import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentService } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
  const result = await AppointmentService.bookAppointment();
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Appointment booked successfully",
    data: result,
  });
});

export const AppointmentController = {
  bookAppointment,
};
