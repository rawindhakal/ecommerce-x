/**
 * NIC Asia Bank card payments via CyberSource Secure Acceptance (Hosted Checkout).
 * Docs: https://developer.cybersource.com/docs/cybs/en-us/secure-acceptance-hosted/developer/all/rest/secure-acceptance-hosted-guide-rest/wm-hosted-intro.html
 *
 * NIC Asia issues the profile_id/access_key/secret_key for their CyberSource
 * merchant profile. Flow: build a signed form and POST-redirect the customer
 * to CyberSource's hosted payment page; CyberSource POSTs a signed response
 * back to our `receiptReturnUrl`, which we verify by recomputing the
 * signature over the returned signed fields.
 */
import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { getSettingsGroup } from "../modules/settings/settings.service.js";
import type { PaymentGateway } from "./types.js";

const ENDPOINTS = {
  sandbox: "https://testsecureacceptance.cybersource.com/pay",
  live: "https://secureacceptance.cybersource.com/pay",
};

async function getConfig() {
  const settings = await getSettingsGroup("payments");
  const cfg = (settings.cybersource_nicasia as Record<string, unknown>) ?? {};
  return {
    enabled: (cfg.enabled as boolean) ?? false,
    mode: ((cfg.mode as string) ?? env.cybersource.mode) as "sandbox" | "live",
    profileId: (cfg.profileId as string) || env.cybersource.profileId,
    accessKey: (cfg.accessKey as string) || env.cybersource.accessKey,
    secretKey: (cfg.secretKey as string) || env.cybersource.secretKey,
  };
}

function signFields(fields: Record<string, string>, signedFieldNames: string[], secretKey: string) {
  const message = signedFieldNames.map((name) => `${name}=${fields[name] ?? ""}`).join(",");
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export const cybersourceGateway: PaymentGateway = {
  key: "CYBERSOURCE_NICASIA",

  async initiate({ order, referenceId, successUrl, failureUrl }) {
    const cfg = await getConfig();
    const signedDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    const fields: Record<string, string> = {
      access_key: cfg.accessKey,
      profile_id: cfg.profileId,
      transaction_uuid: referenceId,
      signed_date_time: signedDateTime,
      locale: "en",
      transaction_type: "sale",
      reference_number: order.orderNumber,
      amount: order.total.toFixed(2),
      currency: order.currency || "NPR",
      bill_to_forename: order.customerName.split(" ")[0] || order.customerName,
      bill_to_surname: order.customerName.split(" ").slice(1).join(" ") || order.customerName,
      bill_to_email: order.customerEmail || "guest@example.com",
      override_custom_receipt_page: successUrl,
      override_custom_cancel_page: failureUrl,
    };

    const signedFieldNames = Object.keys(fields);
    fields.signed_field_names = signedFieldNames.join(",");
    fields.unsigned_field_names = "";
    fields.signature = signFields(fields, [...signedFieldNames, "signed_field_names", "unsigned_field_names"], cfg.secretKey);

    return {
      gateway: "CYBERSOURCE_NICASIA",
      mode: "REDIRECT_FORM",
      redirectUrl: ENDPOINTS[cfg.mode],
      referenceId,
      formFields: fields,
    };
  },

  async verify(payload) {
    const cfg = await getConfig();
    const signedFieldNames = String(payload.signed_field_names ?? "").split(",").filter(Boolean);
    if (!signedFieldNames.length || !payload.signature) {
      return { success: false, message: "Missing CyberSource response signature" };
    }

    const message = signedFieldNames.map((name) => `${name}=${payload[name] ?? ""}`).join(",");
    const expected = createHmac("sha256", cfg.secretKey).update(message).digest("base64");

    if (expected !== payload.signature) {
      return { success: false, message: "Signature mismatch", raw: payload };
    }

    const decision = payload.decision as string;
    if (decision !== "ACCEPT") {
      return { success: false, message: `CyberSource decision: ${decision}`, raw: payload };
    }

    return {
      success: true,
      transactionId: (payload.transaction_id as string) ?? (payload.req_transaction_uuid as string),
      amount: payload.req_amount ? Number(payload.req_amount) : undefined,
      raw: payload,
    };
  },
};

export function newTransactionUuid() {
  return randomUUID();
}
