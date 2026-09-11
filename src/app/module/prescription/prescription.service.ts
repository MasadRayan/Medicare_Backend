import { AppointmentStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { ICreatePrescriptionPayload } from "./prescription.interface";
import httpStatus from "http-status";

const createPrescription = async (payload : ICreatePrescriptionPayload, user : RequestUser) => {

    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId,
        },
    });

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }

    const appointment = await prisma.appointment.findUnique({
        where: {
            id: payload.appointmentId,
        },
    });

    if (!appointment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
    }

    if (appointment.doctorId !== doctor.id) {
        throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to create prescription for this appointment");
    }

    if (appointment.status !== AppointmentStatus.COMPLETED) {
        throw new AppError(httpStatus.BAD_REQUEST, "Prescription can only be created for completed appointments");
    }

    if (appointment.prescriptionUrl) {
        throw new AppError(httpStatus.BAD_REQUEST, "Prescription already exists for this appointment");
    }


}

const getSinglePrescription = async () => {

}

export const PrescriptionService = {
    createPrescription,
    getSinglePrescription,
};