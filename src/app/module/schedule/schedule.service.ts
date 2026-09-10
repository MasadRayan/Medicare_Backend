import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
  ICreateSchedulePayload,
  IUpdateSchedulePayload,
} from "./schedule.interface";
import httpStatus from "http-status";
import type { IQuery } from "../../interfaces";
import type { ScheduleWhereInput } from "../../../generated/prisma/models";
import { ScheduleStatus } from "../../../generated/prisma/enums";

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

const getScheduleById = async (scheduleId: string) => {
  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          email: true,
          specialization: true,
          contactNumber: true,
          userId: true,
        },
      },
      appointments: {
        include: {
          patient: true,
        },
      },
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  return schedule;
};

const updateSchedule = async (
  scheduleId: string,
  payload: IUpdateSchedulePayload,
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

  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  if (schedule.doctorId !== doctor.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this schedule",
    );
  }

  if (
    schedule.status === ScheduleStatus.PUBLISHED &&
    schedule.totalSlots !== schedule.availableSlots
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Cannot update schedule that has already been published and has booked appointments",
    );
  }

  payload.meetingLink = payload.meetingLink || schedule.meetingLink;
  payload.startDateTime = payload.startDateTime || schedule.startDateTime;
  payload.endDateTime = payload.endDateTime || schedule.endDateTime;

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

  const updatedSchedule = await prisma.schedule.update({
    where: {
      id: scheduleId,
    },
    data: {
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      meetingLink: payload.meetingLink,
      totalSlots: totalSlots,
      availableSlots: totalSlots,
      doctorId: doctor.id,
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

  return updatedSchedule;
};

const publishSchedule = async(scheduleId: string, user: RequestUser) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
  }

  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  if (schedule.doctorId !== doctor.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to publish this schedule",
    );
  }

  if (schedule.status === ScheduleStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Schedule is already published",
    );
  }

  const updatedSchedule = await prisma.schedule.update({
    where: {
      id: scheduleId,
    },
    data: {
      status: ScheduleStatus.PUBLISHED,
    },
  });

  return updatedSchedule;
};

const deleteSchedule = async(scheduleId: string, user: RequestUser) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
  }

  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  if (schedule.doctorId !== doctor.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this schedule",
    );
  }

  if (schedule.status === ScheduleStatus.PUBLISHED && schedule.totalSlots !== schedule.availableSlots) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Cannot delete schedule that has already been published and has booked appointments",
    );
  }

  const deletedSchedule = await prisma.schedule.update({
    where: {
      id: scheduleId,
    },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  return deletedSchedule;
};

export const ScheduleServices = {
  createSchedule,
  getMySchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  publishSchedule,
  deleteSchedule
};
