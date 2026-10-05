import test from "node:test";
import assert from "node:assert/strict";

import {
  checkoutSchema,
} from "../src/utils/validators.js";

function baseCheckout() {
  return {
    phoneCountryCode: "GR",
    customer: {
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      phone: "6912345678",
    },
    shippingAddress: {
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      phone: "6912345678",
      country: "Greece",
      city: "",
      postalCode: "",
      addressLine1: "",
      addressLine2: "",
    },
    delivery: "boxnow",
    locker: "12345",
    documentType: "receipt",
    invoiceDetails: null,
    notes: "",
  };
}

test("BOX NOW checkout requires a non-empty locker id", () => {
  const payload = baseCheckout();
  payload.locker = "   ";

  const result = checkoutSchema.safeParse(payload);

  assert.equal(result.success, false);
});

test("receipt checkout does not require invoice details", () => {
  const result = checkoutSchema.safeParse(baseCheckout());

  assert.equal(result.success, true);
  assert.equal(result.data.documentType, "receipt");
});

test("invoice checkout requires invoice details", () => {
  const payload = baseCheckout();
  payload.documentType = "invoice";

  const result = checkoutSchema.safeParse(payload);

  assert.equal(result.success, false);
});

test("invoice checkout accepts complete business details", () => {
  const payload = baseCheckout();
  payload.documentType = "invoice";
  payload.invoiceDetails = {
    companyName: "Skanare Test IKE",
    vatNumber: "123456789",
    taxOffice: "Athens",
    activity: "Retail",
    address: "Test Street 1",
    city: "Athens",
    postalCode: "10431",
  };

  const result = checkoutSchema.safeParse(payload);

  assert.equal(result.success, true);
  assert.equal(result.data.invoiceDetails.vatNumber, "123456789");
});


test("checkout accepts gift box and a personal note", () => {
  const payload = baseCheckout();
  payload.giftOptions = {
    giftBox: true,
    personalNote: "Happy birthday! Enjoy your gift.",
  };

  const result = checkoutSchema.safeParse(payload);

  assert.equal(result.success, true);
  assert.equal(result.data.giftOptions.giftBox, true);
  assert.equal(
    result.data.giftOptions.personalNote,
    "Happy birthday! Enjoy your gift."
  );
});

test("checkout rejects gift notes longer than 200 characters", () => {
  const payload = baseCheckout();
  payload.giftOptions = {
    giftBox: true,
    personalNote: "x".repeat(201),
  };

  const result = checkoutSchema.safeParse(payload);

  assert.equal(result.success, false);
});
