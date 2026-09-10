import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ScheduleController } from "./schedule.controller";
import { Router } from "express";
import { CreateScheduleValidationZodSchema } from "./schedule.validation";

const router = Router()

router.post(
    "/create-schedule",
    auth(Role.DOCTOR),
    validateRequest(CreateScheduleValidationZodSchema),
    ScheduleController.createSchedule,
);


export const ScheduleRoutes = router
