import type { PaymentGateway } from "./types.js";

export const codGateway: PaymentGateway = {
  key: "COD",
  async initiate({ referenceId }) {
    return { gateway: "COD", mode: "COD", referenceId };
  },
  async verify() {
    // COD is "verified" at delivery time by staff, not at checkout.
    return { success: true, message: "Cash on delivery — payment collected on delivery" };
  },
};
