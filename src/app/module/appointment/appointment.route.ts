import { Router } from "express";
import { AppointmentController } from "./appointment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { UpdateAppointmentStatusValidationZodSchema } from "./appointment.validation";

const router = Router();

router.post(
	"/book-appointment",
	auth(Role.PATIENT),
	AppointmentController.bookAppointment,
);
router.post(
	"/pay-appointment",
	auth(Role.PATIENT),
	AppointmentController.payAppointment,
);
router.post(
	"/cancel-appointment",
	auth(Role.PATIENT),
	AppointmentController.cancelAppointment,
);
router.get(
	"/book-appointment/payment/callback",
	AppointmentController.bookAppointmentPaymentCallback,
);

router.patch(
	"/update-status/:appointmentId",
	auth(Role.DOCTOR),
	validateRequest(UpdateAppointmentStatusValidationZodSchema),
	AppointmentController.updateAppointmentStatus,
);

export const AppointmentRoutes = router;
