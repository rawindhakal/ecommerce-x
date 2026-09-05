import type { PaymentGateway } from "./types.js";
import { esewaGateway } from "./esewa.js";
import { fonepayGateway } from "./fonepay.js";
import { cybersourceGateway } from "./cybersource.js";
import { codGateway } from "./cod.js";

const registry: Record<string, PaymentGateway> = {
  ESEWA: esewaGateway,
  FONEPAY: fonepayGateway,
  CYBERSOURCE_NICASIA: cybersourceGateway,
  COD: codGateway,
};

export function getGateway(key: string): PaymentGateway {
  const gateway = registry[key];
  if (!gateway) throw new Error(`Unknown payment gateway: ${key}`);
  return gateway;
}

export * from "./types.js";
