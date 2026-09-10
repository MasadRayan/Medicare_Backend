import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreateSchedulePayload } from "./schedule.interface";
import httpStatus from "http-status";
import { IQuery } from "../../interfaces";
import type { ScheduleWhereInput } from "../../../generated/prisma/models";

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

const getMySchedule = async (query: IQuery, user: RequestUser) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
  }

  const andConditions: ScheduleWhereInput[] = [
    {
      doctorId: doctor.id,
    },
    {
      isDeleted: false,
    },
  ];

  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      AND: andConditions,
    },
    skip,
    take: limit,
    orderBy: {
      startDateTime: "desc",
    },
    include: {
      appointments: {
        include: {
          patient: true,
        },
      },
    },
  });

  const totalScheduleCount = await prisma.schedule.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: schedules,
    meta: {
      page: page,
      limit: limit,
      total: totalScheduleCount,
      totalPages: Math.ceil(totalScheduleCount / limit),
    },
  };
};

const getAllSchedules = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: ScheduleWhereInput[] = [];

  if (query.doctorId) {
    andConditions.push({
      doctorId: query.doctorId,
    });
  }
  if (query.email) {
    andConditions.push({
      doctor: {
        email: query.email,
      },
    });
  }
  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

  if (query.searchTerm) {
    andConditions.push({
      doctor: {
        OR: [
          { name: { contains: query.searchTerm, mode: "insensitive" } },
          { email: { contains: query.searchTerm, mode: "insensitive" } },
          {
            specialization: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        ],
      },
    });
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      AND: andConditions,
    },
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      appointments: {
        include: {
          patient: true,
        },
      },
    },
  });

  const totalScheduleCount = await prisma.schedule.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: schedules,
    meta: {
      page: page,
      limit: limit,
      total: totalScheduleCount,
      totalPages: Math.ceil(totalScheduleCount / limit),
    },
  };
};

export const ScheduleServices = {
  createSchedule,
  getMySchedule,
};
