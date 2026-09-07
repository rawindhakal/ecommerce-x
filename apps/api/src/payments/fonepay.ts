/**
 * Fonepay dynamic QR integration.
 *
 * Fonepay merchant integration is issued per-merchant (typically via your
 * settlement bank, e.g. NIC Asia / other partner banks) as a PDF spec, and
 * exact field names/endpoint paths can vary slightly by bank partner and API
 * version. This implements the commonly-published "third-party dynamic QR"
 * flow: generate a QR bound to a unique PRN (product reference number) and
 * amount, show it to the customer, then poll/verify payment status by PRN.
 * CONFIRM the endpoint paths, field names, and HMAC message format against
 * the merchant integration guide you receive from Fonepay/your bank before
 * going live — the shapes below are wired end-to-end and easy to adjust.
 */
import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { getSettingsGroup } from "../modules/settings/settings.service.js";
import type { PaymentGateway, PaymentInitiateResult } from "./types.js";

const ENDPOINTS = {
  sandbox: {
    qr: "https://dev-clientapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload",
    verify: "https://dev-clientapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/dynamicQrVerification",
  },
  live: {
    qr: "https://clientapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload",
    verify: "https://clientapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/dynamicQrVerification",
  },
};

async function getConfig() {
  const settings = await getSettingsGroup("payments");
  const cfg = (settings.fonepay as Record<string, unknown>) ?? {};
  return {
    enabled: (cfg.enabled as boolean) ?? false,
    mode: ((cfg.mode as string) ?? env.fonepay.mode) as "sandbox" | "live",
    merchantCode: (cfg.merchantCode as string) || env.fonepay.merchantCode,
    secretKey: (cfg.secretKey as string) || env.fonepay.secretKey,
  };
}

function sign(parts: (string | number)[], secretKey: string) {
  return createHmac("sha512", secretKey).update(parts.join(",")).digest("hex");
}

export const fonepayGateway: PaymentGateway = {
  key: "FONEPAY",

  async initiate({ order, referenceId }) {
    const cfg = await getConfig();
    const endpoint = ENDPOINTS[cfg.mode].qr;
    const amount = order.total.toFixed(2);
    const remarks1 = order.orderNumber;
    const remarks2 = "Online order";

    const dataValidation = sign([amount, referenceId, cfg.merchantCode, remarks1, remarks2], cfg.secretKey);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantCode: cfg.merchantCode,
        amount,
        remarks1,
        remarks2,
        prn: referenceId,
        currency: "NPR",
        dataValidation,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const errorResult: PaymentInitiateResult = {
        gateway: "FONEPAY",
        mode: "QR",
        referenceId,
        formFields: { error: `Fonepay QR generation failed (${res.status}): ${text}` },
      };
      return errorResult;
    }

    const json = (await res.json()) as { qrMessage?: string; thirdpartyQrWebSocketUrl?: string };

    const result: PaymentInitiateResult = {
      gateway: "FONEPAY",
      mode: "QR",
      referenceId,
      qrPayload: json.qrMessage,
      formFields: json.thirdpartyQrWebSocketUrl ? { webSocketUrl: json.thirdpartyQrWebSocketUrl } : {},
    };
    return result;
  },

  async verify(payload) {
    const cfg = await getConfig();
    const referenceId = payload.referenceId as string;
    if (!referenceId) return { success: false, message: "Missing referenceId (prn)" };

    const dataValidation = sign([referenceId, cfg.merchantCode], cfg.secretKey);
    const res = await fetch(ENDPOINTS[cfg.mode].verify, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prn: referenceId, merchantCode: cfg.merchantCode, dataValidation }),
    });

    if (!res.ok) return { success: false, message: `Fonepay verification request failed (${res.status})` };
    const json = (await res.json()) as { paymentStatus?: string; amount?: string; fonepayTraceId?: string };

    if (json.paymentStatus?.toLowerCase() !== "success") {
      return { success: false, message: `Fonepay status: ${json.paymentStatus}`, raw: json };
    }

    return { success: true, transactionId: json.fonepayTraceId, referenceId, amount: json.amount ? Number(json.amount) : undefined, raw: json };
  },
};
