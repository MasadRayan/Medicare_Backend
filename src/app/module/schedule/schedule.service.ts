import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreateSchedulePayload } from "./schedule.interface";
import httpStatus from "http-status";

const createSchedule = async (
	payload: ICreateSchedulePayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}

	const startOfTheDay = startOfDay(payload.startDateTime);
	const endOfTheDay = addDays(startOfTheDay, 1);

	const existingSchedule = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			startDateTime: {
				gte: startOfTheDay,
				lt: endOfTheDay,
			},
			isDeleted: false,
		},
	});

	if (existingSchedule) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Schedule already exists for the given date",
		);
	}

	const durationINMinures = differenceInMinutes(
		payload.endDateTime,
		payload.startDateTime,
	);

	const MINUTES_ALLOCATED_PER_SLOT = 20;

	const totalSlots = Math.floor(durationINMinures / MINUTES_ALLOCATED_PER_SLOT);

	const schedule = await prisma.schedule.create({
		data: {
			doctorId: doctor.id,
			startDateTime: payload.startDateTime,
			endDateTime: payload.endDateTime,
			meetingLink: payload.meetingLink,
			totalSlots: totalSlots,
			availableSlots: totalSlots,
		},
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});

	return schedule;
};

export const scheduleService = {
	createSchedule,
};
