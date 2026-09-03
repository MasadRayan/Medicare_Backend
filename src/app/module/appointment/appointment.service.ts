import { AppointmentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

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

    return bkashCreatePaymentResult;
  });
};

const bookAppointmentPaymentCallback = async (query: Record<string, any>) => {
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
    return {
      bkashExecutePaymentResult,
      redirectURL: `${config.frontend_url}/dashboard/my-appointments?status=success&paymentID=${paymentId}`,
    };
  }
  if (paymentStatus === "failure") {
    return {
      bkashExecutePaymentResult,
      redirectURL: `${config.frontend_url}/dashboard/my-appointments?status=failure&paymentID=${paymentId}`,
    };
  }
  if (paymentStatus === "cancel") {
    return {
      bkashExecutePaymentResult,
      redirectURL: `${config.frontend_url}/dashboard/my-appointments?status=cancel&paymentID=${paymentId}`,
    };
  }

  return {
    bkashExecutePaymentResult,
    redirectURL: `${config.frontend_url}/dashboard/my-appointments`,
  };
};

export const AppointmentService = {
  bookAppointment,
  bookAppointmentPaymentCallback,
};
