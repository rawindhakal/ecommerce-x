/**
 * eSewa ePay v2 integration.
 * Docs: https://developer.esewa.com.np/pages/Epay#/epay-v2
 *
 * Flow: build a signed HTML form and POST (redirect) the customer to eSewa's
 * payment page. eSewa redirects back to `successUrl`/`failureUrl` with a
 * base64-encoded `data` query param containing the signed transaction result,
 * which we verify here, then re-confirm with eSewa's status-check API.
 */
import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { getSettingsGroup } from "../modules/settings/settings.service.js";
import { timingSafeEqualString } from "../lib/timing-safe-equal.js";
import type { PaymentGateway } from "./types.js";

const ENDPOINTS = {
  sandbox: {
    form: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    status: "https://rc.esewa.com.np/api/epay/transaction/status/",
  },
  live: {
    form: "https://epay.esewa.com.np/api/epay/main/v2/form",
    status: "https://epay.esewa.com.np/api/epay/transaction/status/",
  },
};

async function getConfig() {
  const settings = await getSettingsGroup("payments");
  const cfg = (settings.esewa as Record<string, unknown>) ?? {};
  return {
    enabled: (cfg.enabled as boolean) ?? true,
    mode: ((cfg.mode as string) ?? env.esewa.mode) as "sandbox" | "live",
    merchantCode: (cfg.merchantCode as string) || env.esewa.merchantCode,
    secretKey: (cfg.secretKey as string) || env.esewa.secretKey,
  };
}

function sign(message: string, secretKey: string) {
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export const esewaGateway: PaymentGateway = {
  key: "ESEWA",

  async initiate({ order, referenceId, successUrl, failureUrl }) {
    const cfg = await getConfig();
    const endpoint = ENDPOINTS[cfg.mode].form;

    const amount = order.total;
    const taxAmount = 0;
    const totalAmount = amount + taxAmount;

    const signedFieldNames = "total_amount,transaction_uuid,product_code";
    const message = `total_amount=${totalAmount},transaction_uuid=${referenceId},product_code=${cfg.merchantCode}`;
    const signature = sign(message, cfg.secretKey);

    return {
      gateway: "ESEWA",
      mode: "REDIRECT_FORM",
      redirectUrl: endpoint,
      referenceId,
      formFields: {
        amount: String(amount),
        tax_amount: String(taxAmount),
        total_amount: String(totalAmount),
        transaction_uuid: referenceId,
        product_code: cfg.merchantCode,
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: signedFieldNames,
        signature,
      },
    };
  },

  async verify(payload) {
    const cfg = await getConfig();
    const dataParam = payload.data as string | undefined;
    if (!dataParam) return { success: false, message: "Missing eSewa response data" };

    let decoded: Record<string, string>;
    try {
      decoded = JSON.parse(Buffer.from(dataParam, "base64").toString("utf8"));
    } catch {
      return { success: false, message: "Malformed eSewa response" };
    }

    const expectedSignature = sign(
      `transaction_code=${decoded.transaction_code},status=${decoded.status},total_amount=${decoded.total_amount},transaction_uuid=${decoded.transaction_uuid},product_code=${cfg.merchantCode},signed_field_names=${decoded.signed_field_names}`,
      cfg.secretKey
    );
    if (!decoded.signature || !timingSafeEqualString(expectedSignature, decoded.signature)) {
      return { success: false, message: "Signature mismatch", raw: decoded };
    }
    if (decoded.status !== "COMPLETE") {
      return { success: false, message: `eSewa status: ${decoded.status}`, raw: decoded };
    }

    // Re-confirm with eSewa's status API for defense-in-depth against replayed/forged callbacks.
    try {
      const statusUrl = new URL(ENDPOINTS[cfg.mode].status);
      statusUrl.searchParams.set("product_code", cfg.merchantCode);
      statusUrl.searchParams.set("total_amount", String(decoded.total_amount ?? ""));
      statusUrl.searchParams.set("transaction_uuid", String(decoded.transaction_uuid ?? ""));
      const res = await fetch(statusUrl.toString());
      const statusJson = (await res.json()) as { status?: string };
      if (statusJson.status !== "COMPLETE") {
        return { success: false, message: `eSewa status-check: ${statusJson.status}`, raw: { decoded, statusJson } };
      }
    } catch (err) {
      return { success: false, message: "Could not reach eSewa status-check API", raw: err };
    }

    return {
      success: true,
      transactionId: decoded.transaction_code,
      referenceId: decoded.transaction_uuid,
      amount: Number(decoded.total_amount),
      raw: decoded,
    };
  },
};
