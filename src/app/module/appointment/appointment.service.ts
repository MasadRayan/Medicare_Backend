import { success } from "zod";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointment = async () => {
  //business logic for booking appointment will be here

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
        payerReference: "01723888888",
        callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
        merchantAssociationInfo: "MI05MID54RF09123456One",
        amount: "500",
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: "Inv0124",
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
};

const bookAppointmentPaymentCallback = async () => {
  //business logic for handling payment callback will be here
  return {
    success: true,
    message: "Payment callback handled successfully",
  }
}

export const AppointmentService = {
  bookAppointment,
  bookAppointmentPaymentCallback
};
