import {
	AppointmentStatus,
	PaymentStatus,
    ScheduleStatus,
} from "../../../generated/prisma/enums";
import httpStatus from "http-status";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { IBookAppointmentPayload } from "./appointment.interface";
import { addMinutes, isAfter, isSameDay } from "date-fns";
import { transporter } from "../../lib/nodemailer";

const bookAppointment = async (payload: IBookAppointmentPayload, user: RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		//business logic for booking appointment will be here

		const patient = await tx.patient.findUnique({
			where: {
				userId: user.userId,
			},
		})

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
		}

		const schedule = await tx.schedule.findUnique({
			where: {
				id: payload.scheduleId,
			},
			include: {
				doctor: true,
			}
		});

		if (!schedule || schedule.isDeleted) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
		}

		if (schedule.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(httpStatus.BAD_REQUEST, "Schedule is not published");
		}

		const now = new Date();

		if (!isSameDay(now, schedule.startDateTime)) {
			throw new AppError(httpStatus.BAD_REQUEST, "Schedule is not for today");
		}

		if (isAfter(now, schedule.startDateTime)) {
			throw new AppError(httpStatus.BAD_REQUEST, "Schedule is in the past");
		}

		if (schedule.totalSlots === schedule.availableSlots) {
			throw new AppError(httpStatus.BAD_REQUEST, "Schedule is fully booked");
		}

		const existingAppointment = await tx.appointment.findFirst({
			where: {
				patientId: patient.id,
				scheduleId: schedule.id,
				
			},
		});

		if (existingAppointment?.status === AppointmentStatus.PENDING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have a pending appointment for this schedule",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have a completed appointment for this schedule",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have an ongoing appointment for this schedule",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have a confirmed appointment for this schedule",
			);
		}

		if (!schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Consultation fee is not set for this doctor",
			);
		}

		const amount = schedule.doctor.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				patientId: patient.id,
				doctorId: schedule.doctorId,
				scheduleId: schedule.id,
			},
		});

		const bkashIdToken = await getBkashIdToken();
		if (!bkashIdToken) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get bKash ID token",
			);
		}

		const bkashCreatePaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					mode: "0011",
					payerReference: user.email,
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					merchantAssociationInfo: "MI05MID54RF09123456One",
					amount: amount,
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: appointment.id,
				}),
			},
		);

		const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

		if (!bkashCreatePaymentResponse.ok) {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				`Failed to create bKash payment: ${bkashCreatePaymentResult.message}`,
			);
		}

		//create a payment record in the database

		await tx.payment.create({
			data: {
				merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
				amount: amount,
				currency: "BDT",
				appointmentId: appointment.id,
				bkashPaymentId: bkashCreatePaymentResult.paymentID,
				gatewayResponse: bkashCreatePaymentResult,
				payerReference: user.email,
			},
		});

		return {
			paymentURL: bkashCreatePaymentResult.bkashURL,
		};
	});

	return transactionResult;
};

const payAppointment = async (payload: any, user: RequestUser) => {
	const { appointmentId } = payload;

	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			schedule: {
				include: {
					doctor: true,
				},
			},
		}
	});

	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (existingAppointment.status !== "PENDING") {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment is not pending");
	}

	if (!existingAppointment.schedule.doctor.consultationFee) {
		throw new AppError(httpStatus.BAD_REQUEST, "Consultation fee not found");
	}

	const amount = existingAppointment.schedule.doctor.consultationFee.toString();

	const bkashIdToken = await getBkashIdToken();
	if (!bkashIdToken) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to get bKash ID token",
		);
	}

	const bkashCreatePaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: amount,
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: existingAppointment.id,
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

	if (!bkashCreatePaymentResponse.ok) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Failed to create bKash payment: ${bkashCreatePaymentResult.message}`,
		);
	}

	await prisma.payment.update({
		where: {
			appointmentId: existingAppointment.id,
		},
		data: {
			merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			gatewayResponse: bkashCreatePaymentResult,
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
	});
	return {
		paymentURL: bkashCreatePaymentResult.bkashURL,
	};
};

const bookAppointmentPaymentCallback = async (query: Record<string, any>) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const paymentId = query.paymentID;
		const paymentStatus = query.status;

		if (!paymentId || !paymentStatus) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Missing required query parameters",
			);
		}

		const bkashIdToken = await getBkashIdToken();
		if (!bkashIdToken) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get bKash ID token",
			);
		}

		const bkashExecutePaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/execute`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: paymentId,
				}),
			},
		);
		const bkashExecutePaymentResult = await bkashExecutePaymentResponse.json();

		if (!bkashExecutePaymentResponse.ok) {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				`Failed to execute bKash payment: ${bkashExecutePaymentResult.message}`,
			);
		}
		console.log(bkashExecutePaymentResult);

		if (paymentStatus === "success") {

			const appointment = await tx.appointment.findUnique({
				where: {
					id: bkashExecutePaymentResult.merchantInvoiceNumber,
				},
				include: {
					schedule: {
						include:{
							doctor: true,
						}
					},
					patient: true,
				}
			});

			if (!appointment) {
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Appointment not found for the given merchantInvoiceNumber",
				);
			}

			const newAvailableSlots = appointment.schedule.availableSlots - 1;

			const alreadyBookedAppointment = appointment.schedule.totalSlots - appointment.schedule.availableSlots

			const serialNumber = alreadyBookedAppointment + 1;

			const joiningTime = addMinutes(appointment.schedule.startDateTime, 
				(serialNumber - 1) *20
			)

			await tx.appointment.update({
				where: {
					id: bkashExecutePaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
					joiningTime: joiningTime,
					serialNumber: serialNumber,
				},
			});

			await tx.schedule.update({
				where: {
					id: appointment.scheduleId,
				},
				data: {
					availableSlots: newAvailableSlots,
				},
			});

			await transporter.sendMail({
				from: config.email_sender,
				to: appointment.patient.email,
				subject: "Your Appointment Invoice - PH Healthcare System",
				text: "Thank you for booking an appointment. Please find your invoice attached.",
				
			})

			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: bkashExecutePaymentResult.trxID,
					gatewayResponse: bkashExecutePaymentResult,
					paidAt: bkashExecutePaymentResult.agreementExecuteTime,
				},
			});

			return {
				redirectURL: `${config.frontend_url}/dashboard/my-appointments?status=success&paymentID=${paymentId}`,
			};
		} else if (paymentStatus === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: bkashExecutePaymentResult,
				},
			});
			return {
				redirectURL: `${config.frontend_url}/dashboard/my-appointments?status=failure&paymentID=${paymentId}`,
			};
		} else if (paymentStatus === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: bkashExecutePaymentResult,
				},
			});
			return {
				bkashExecutePaymentResult,
				redirectURL: `${config.frontend_url}/dashboard/my-appointments?status=cancel&paymentID=${paymentId}`,
			};
		} else {
			return {
				redirectURL: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed&paymentID=${paymentId}`,
			};
		}
	});
	return transactionResult;
};

const cancelAppointment = async (payload: any) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const { appointmentId } = payload;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
			},
			include: {
				payment: true,
			},
		});

		if (!existingAppointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
		}

		if (
			existingAppointment.status === "ONGOING" ||
			existingAppointment.status === "COMPLETED"
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot cancel an ongoing or completed appointment",
			);
		}

		if (existingAppointment.status === "CANCELLED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment is already cancelled",
			);
		}

		const updateAppointment = await tx.appointment.update({
			where: {
				id: appointmentId,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		const bkashIdToken = await getBkashIdToken();
		if (!bkashIdToken) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get bKash ID token",
			);
		}

		const bkashRefundPaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: existingAppointment.payment?.bkashPaymentId,
					trxID: existingAppointment.payment?.bkashTrxId,
					amount: existingAppointment.payment?.amount.toString(),
					sku: "Appointment Cancellation",
					reason: "Appointment cancelled by user",
				}),
			},
		);
		const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

		const updatePayment = await tx.payment.update({
			where: {
				appointmentId: existingAppointment.id,
			},
			data: {
				refundTrxId: bkashRefundPaymentResult.trxID,
				refundAt: bkashRefundPaymentResult.completedTime,
				refundAmount: bkashRefundPaymentResult.amount,
				refundReason: "Appointment cancelled by user",
				status: PaymentStatus.REFUNDED,
				gatewayResponse: bkashRefundPaymentResult,
			},
		});
		return {
			appointment: updateAppointment,
			payment: updatePayment,
		};
	});
	return transactionResult;
};

export const AppointmentService = {
	bookAppointment,
	payAppointment,
	bookAppointmentPaymentCallback,
	cancelAppointment,
};
