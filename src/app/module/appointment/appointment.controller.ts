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

const bookAppointmentPaymentCallback = catchAsync(
  async (req: Request, res: Response) => {
    const {bkashExecutePaymentResult, redirectURL} = await AppointmentService.bookAppointmentPaymentCallback(req.query);
    console.log(bkashExecutePaymentResult)

    res.redirect(redirectURL);

    // sendResponse(res, {
    //   statusCode: httpStatus.OK,
    //   success: true,
    //   message: "Payment callback handled successfully",
    //   data: result,
    // });
  },
);

export const AppointmentController = {
  bookAppointment,
  bookAppointmentPaymentCallback,
};
