import { AppointmentStatus, DoctorverificationStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/browser";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const getAdminAnalytics = async () => {
    const totalDoctors = await prisma.doctor.count({
        where : {
            isDeleted: false
        }
    });
    const totalPendingDoctorApplication = await prisma.doctor.count({
        where : {
            isDeleted: false,
            verificationStatus: DoctorverificationStatus.PENDING
        }
    });
    const totalapprovedDoctors = await prisma.doctor.count({
        where : {
            isDeleted: false,
            verificationStatus: DoctorverificationStatus.APPROVED
        }
    });
    const totalRejectedDoctors = await prisma.doctor.count({
        where : {
            isDeleted: false,
            verificationStatus: DoctorverificationStatus.REJECTED
        }
    });
    const totalPatients = await prisma.patient.count({
        where : {
            isDeleted: false
        }
    });
    const totalAppointments = await prisma.appointment.count();
    const totalcompletedAppointments = await prisma.appointment.count({
        where : {
            status: AppointmentStatus.COMPLETED
        }
    });
    const totalcancelledAppointments = await prisma.appointment.count({
        where : {
            status: AppointmentStatus.CANCELLED
        }
    });
    const totalpendingAppointments = await prisma.appointment.count({
        where : {
            status: AppointmentStatus.PENDING
        }
    });


    return {
        totalDoctors,
        totalPendingDoctorApplication,
        totalapprovedDoctors,
        totalRejectedDoctors,
        totalPatients,
        totalAppointments,
        totalcompletedAppointments,
        totalcancelledAppointments,
        totalpendingAppointments
    }

}

const getDoctorAnalytics = async (user : RequestUser) => {

    const doctor = await prisma.doctor.findUnique({
        where : {
            userId: user.userId
        }
    });
    if(!doctor){
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }

    const totalSchedules = await prisma.schedule.count({
        where: { doctorId: doctor.id, isDeleted: false },
    });

    const publishedSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.PUBLISHED,
        },
    });

    const totalAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id },
    });

    const upcomingAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.CONFIRMED },
    });

    const ongoingAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.ONGOING },
    });

    const completedAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.COMPLETED },
    });

    const cancelledAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.CANCELLED },
    });

    const totalDoctorRefundedResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });

    const totalDoctorRefunded = totalDoctorRefundedResult._sum.amount?.toNumber() || 0;

    const totalDoctorEarningsResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });

    const totalDoctorEarnings = (totalDoctorEarningsResult._sum.amount?.toNumber() || 0) - totalDoctorRefunded;

    

    return {
        totalSchedules,
        publishedSchedules,
        totalAppointments,
        upcomingAppointments,
        ongoingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalDoctorEarnings,
        totalDoctorRefunded
    }
}

const getPatientAnalytics = async (user : RequestUser) => {
    const patient = await prisma.patient.findUnique({
        where : {
            userId: user.userId
        }
    });
    if(!patient){
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
    }

    const totalAppointments = await prisma.appointment.count({
        where: { patientId: patient.id },
    });

    const upcomingAppointments = await prisma.appointment.count({
        where: { patientId: patient.id, status: AppointmentStatus.CONFIRMED },
    });

    const completedAppointments = await prisma.appointment.count({
        where: { patientId: patient.id, status: AppointmentStatus.COMPLETED },
    });

    const cancelledAppointments = await prisma.appointment.count({
        where: { patientId: patient.id, status: AppointmentStatus.CANCELLED },
    });

    const totalAmountSpentResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });

    const totalAmountSpent = totalAmountSpentResult._sum.amount?.toNumber() || 0;

    const totalRefundedResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });

    const totalRefunded = totalRefundedResult._sum.amount?.toNumber() || 0;

    return {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalAmountSpent,
        totalRefunded
    }


}

export const AnalyticsService = {
    getAdminAnalytics,
    getDoctorAnalytics,
    getPatientAnalytics
}