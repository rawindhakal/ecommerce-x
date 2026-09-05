import type { PaymentInitiateResult, PaymentVerifyResult } from "@ecommerce-x/shared";

export interface OrderForPayment {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  customerName: string;
  customerEmail?: string | null;
}

export interface PaymentGatewayConfig {
  enabled: boolean;
  mode: "sandbox" | "live";
  [key: string]: unknown;
}

export interface PaymentGateway {
  key: "ESEWA" | "FONEPAY" | "CYBERSOURCE_NICASIA" | "COD";
  initiate(params: {
    order: OrderForPayment;
    referenceId: string;
    successUrl: string;
    failureUrl: string;
  }): Promise<PaymentInitiateResult>;
  verify(payload: Record<string, unknown>): Promise<PaymentVerifyResult>;
}

export type { PaymentInitiateResult, PaymentVerifyResult };
