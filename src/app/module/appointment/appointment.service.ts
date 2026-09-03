import {
  AppointmentStatus,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";

const bookAppointment = async (payload: any, user: RequestUser) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    //business logic for booking appointment will be here
    const appointment = await tx.appointment.create({
      data: {
        status: AppointmentStatus.PENDING,
      },
    });

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken) {
      throw new Error("Failed to get bKash ID token");
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
          amount: "500",
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: appointment.id,
        }),
      },
    );

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

    if (!bkashCreatePaymentResponse.ok) {
      throw new Error(
        `Failed to create bKash payment: ${bkashCreatePaymentResult.message}`,
      );
    }

    //create a payment record in the database

    await tx.payment.create({
      data: {
        merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
        amount: "1200",
        currency: "BDT",
        appointmentId: appointment.id,
        bkashPaymentId: bkashCreatePaymentResult.paymentID,
        gatewayResponse: bkashCreatePaymentResult,
        payerReference: user.email,
      },
    });

    return {
      paymentURL : bkashCreatePaymentResult.bkashURL
    };
  });

  return transactionResult;
};

const bookAppointmentPaymentCallback = async (query: Record<string, any>) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const paymentId = query.paymentID;
    const paymentStatus = query.status;

    if (!paymentId || !paymentStatus) {
      throw new Error("Missing required query parameters");
    }

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken) {
      throw new Error("Failed to get bKash ID token");
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
      throw new Error(
        `Failed to execute bKash payment: ${bkashExecutePaymentResult.message}`,
      );
    }
    console.log(bkashExecutePaymentResult);

    if (paymentStatus === "success") {
      await tx.appointment.update({
        where: {
          id: bkashExecutePaymentResult.merchantInvoiceNumber,
        },
        data: {
          status: AppointmentStatus.CONFIRMED,
        },
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
  });
  return transactionResult;
};

export const AppointmentService = {
  bookAppointment,
  bookAppointmentPaymentCallback,
};
