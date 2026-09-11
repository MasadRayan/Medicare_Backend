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
import type {
	IBookAppointmentPayload,
	ICancelAppointmentPayload,
	IPayAppointmentPayload,
	IUpdateAppointmentStatusPayload,
} from "./appointment.interface";
import { addMinutes, isAfter, isBefore, isSameDay, subHours } from "date-fns";
import { transporter } from "../../lib/nodemailer";
import PDFDocument from "pdfkit";
import type { IQuery } from "../../interfaces";
import type { AppointmentWhereInput } from "../../../generated/prisma/models";

const bookAppointment = async (
	payload: IBookAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		//business logic for booking appointment will be here

		const patient = await tx.patient.findUnique({
			where: {
				userId: user.userId,
			},
		});

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
		}

		const schedule = await tx.schedule.findUnique({
			where: {
				id: payload.scheduleId,
			},
			include: {
				doctor: true,
			},
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

const payAppointment = async (
	payload: IPayAppointmentPayload,
	user: RequestUser,
) => {
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
		},
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
					schedule: true,
					patient: true,
					doctor: true,
				},
			});

			if (!appointment) {
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Appointment not found for the given merchantInvoiceNumber",
				);
			}

			const newAvailableSlots = appointment.schedule.availableSlots - 1;

			const alreadyBookedAppointment =
				appointment.schedule.totalSlots - appointment.schedule.availableSlots;

			const serialNumber = alreadyBookedAppointment + 1;

			const joiningTime = addMinutes(
				appointment.schedule.startDateTime,
				(serialNumber - 1) * 20,
			);

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

			const pdfDocument = new PDFDocument({ margin: 50 });

			const pdfChunks: Buffer[] = [];

			pdfDocument.on("data", (chunk: Buffer) => {
				pdfChunks.push(chunk);
			});

			const pdfReadyPromise = new Promise<Buffer>((resolve) => {
				pdfDocument.on("end", () => {
					resolve(Buffer.concat(pdfChunks));
				});
			});

			pdfDocument.fontSize(20).text("Medi Care System", { align: "center" });
			pdfDocument.fontSize(14).text("Appointment Invoice", { align: "center" });
			pdfDocument.moveDown(2);

			pdfDocument
				.fontSize(12)
				.text(`Patient Name: ${appointment.patient?.name}`);
			pdfDocument.text(`Patient Email: ${appointment.patient?.email}`);
			pdfDocument.moveDown();

			pdfDocument.text(`Doctor Name: ${appointment.doctor?.name}`);
			pdfDocument.text(`Specialization: ${appointment.doctor?.specialization}`);
			pdfDocument.moveDown();

			pdfDocument.text(
				`Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`,
			);
			pdfDocument.text(`Your Joining Time: ${joiningTime.toString()}`);
			pdfDocument.text(`Your Serial Number: ${serialNumber}`);
			pdfDocument.text(`Meeting Link: ${appointment.schedule.meetingLink}`);
			pdfDocument.moveDown();

			pdfDocument.text(`Amount Paid: ${bkashExecutePaymentResult.amount} BDT`);
			pdfDocument.text(`Payment Method: bKash`);
			pdfDocument.text(`Transaction Id: ${bkashExecutePaymentResult.trxID}`);
			pdfDocument.text(
				`Paid At: ${bkashExecutePaymentResult.paymentExecuteTime}`,
			);

			pdfDocument.end();

			const pdfBuffer = await pdfReadyPromise;

			await transporter.sendMail({
				from: config.email_sender,
				to: appointment.patient.email,
				subject: "Your Appointment Invoice - Medi Care System",
				text: "Thank you for booking an appointment. Please find your invoice attached.",
				attachments: [
					{
						filename: "invoice.pdf",
						content: pdfBuffer,
					},
				],
			});

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
	}, {
		maxWait: 10000, // Maximum time to wait for the transaction to complete
		timeout: 30000, // Maximum time for the entire transaction
	});
	return transactionResult;
};

const cancelAppointment = async (
	payload: ICancelAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const { appointmentId } = payload;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
				patient: {
					email: user.email,
				},
			},
			include: {
				payment: true,
				schedule: true,
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

		await tx.schedule.update({
			where: {
				id: existingAppointment.schedule.id,
			},
			data: {
				availableSlots: {
					increment: 1,
				},
			},
		});

		//refund Process
		const now = new Date();
		const startDateTime = existingAppointment.schedule.startDateTime;

		const refundCutOffTime = subHours(startDateTime, 1);

		const isEligible = isBefore(now, refundCutOffTime);

		if (isEligible) {
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

			await tx.payment.update({
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
		}

		const newPaymentInfo = prisma.payment.findUnique({
			where: {
				appointmentId: existingAppointment.id,
			},
		});

		return {
			appointment: updateAppointment,
			payment: newPaymentInfo,
		};
	});
	return transactionResult;
};

const updateAppointment = async (
	appointmentId: string,
	payload: IUpdateAppointmentStatusPayload,
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

	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (appointment.doctorId !== doctor.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not authorized to update this appointment",
		);
	}

	if (appointment.status === AppointmentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot update a completed appointment",
		);
	}

	if (appointment.status === AppointmentStatus.CANCELLED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot update a cancelled appointment",
		);
	}

	if (appointment.status === AppointmentStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot update a pending appointment",
		);
	}

	if (appointment.status === AppointmentStatus.CONFIRMED) {
		if (payload.status !== "ONGOING") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You can only update a confirmed appointment to ongoing",
			);
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id,
			},
			data: {
				status: AppointmentStatus.ONGOING,
			},
		});
	}

	if (appointment.status === AppointmentStatus.ONGOING) {
		if (payload.status !== "COMPLETED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You can only update an ongoing appointment to completed",
			);
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id,
			},
			data: {
				status: AppointmentStatus.COMPLETED,
			},
		});
	}

	const updatedAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointment.id,
		},
	});

	return updatedAppointment;
};

const getMyAppointments = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const patient = await prisma.patient.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			patientId: patient.id,
		},
	];

	if (query.status) {
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	}

	const appointments = await prisma.appointment.findMany({
		where: {
			AND: andConditions,
		},
		orderBy: {
			[sortBy]: sortOrder,
		},
		skip: skip,
		take: limit,
		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					specialization: true,
				},
			},
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: {
			AND: andConditions,
		},
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getDoctorAppointments = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			doctorId: doctor.id,
		},
	];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy]: sortOrder },
		include: {
			patient: {
				select: { id: true, name: true, email: true, contactNumber: true },
			},
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getAllAppointments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: AppointmentWhereInput[] = [];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	if (query.doctorId) {
		andConditions.push({ doctorId: query.doctorId });
	}

	if (query.patientId) {
		andConditions.push({ patientId: query.patientId });
	}

	if (query.doctorEmail) {
		andConditions.push({
			doctor: {
				email: query.doctorEmail,
			},
		});
	}
	if (query.patientEmail) {
		andConditions.push({
			patient: {
				email: query.patientEmail,
			},
		});
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy]: sortOrder },
		include: {
			patient: { select: { id: true, name: true, email: true } },
			doctor: { select: { id: true, name: true, specialization: true } },
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getSingleAppointment = async (
	appointmentId: string,
	user: RequestUser,
) => {
	const apointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			patient: { select: { id: true, name: true, email: true, userId: true } },
			doctor: {
				select: { id: true, name: true, specialization: true, userId: true },
			},
			schedule: true,
			payment: true,
		},
	});

	if (!apointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
	}

	if (user.role === "PATIENT") {
		if (apointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view this appointment",
			);
		}
	}
	if (user.role === "DOCTOR") {
		if (apointment.doctor.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view this appointment",
			);
		}
	}

	return apointment;
};

export const AppointmentService = {
	bookAppointment,
	payAppointment,
	bookAppointmentPaymentCallback,
	cancelAppointment,
	updateAppointment,
	getMyAppointments,
	getDoctorAppointments,
	getAllAppointments,
	getSingleAppointment,
};
