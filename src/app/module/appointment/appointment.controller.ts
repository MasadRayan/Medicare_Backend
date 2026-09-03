import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentService } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user;
  const result = await AppointmentService.bookAppointment(payload, user!);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Appointment booked successfully",
    data: result,
  });
});

const payAppointment = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user;
  const result = await AppointmentService.payAppointment(payload, user!);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Appointment paid successfully",
    data: result,
  });
});

const bookAppointmentPaymentCallback = catchAsync(
  async (req: Request, res: Response) => {
    const { redirectURL } = await AppointmentService.bookAppointmentPaymentCallback(req.query);
    res.redirect(redirectURL);
  },
);

export const AppointmentController = {
  bookAppointment,
  payAppointment,
  bookAppointmentPaymentCallback,
};
