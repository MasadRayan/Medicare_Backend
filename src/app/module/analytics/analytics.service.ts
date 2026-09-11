import { AppointmentStatus, DoctorverificationStatus } from "../../../generated/prisma/browser";
import { prisma } from "../../lib/prisma";

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

const getDoctorAnalytics = async () => {
    
}

const getPatientAnalytics = async () => {
    
}

export const AnalyticsService = {
    getAdminAnalytics,
    getDoctorAnalytics,
    getPatientAnalytics
}