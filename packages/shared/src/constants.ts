export const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
] as const;

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const PAYMENT_GATEWAYS = ["ESEWA", "FONEPAY", "CYBERSOURCE_NICASIA", "COD", "CASH", "CARD_POS"] as const;

export const DEFAULT_CURRENCY = "NPR";

export const COOKIE_NAMES = {
  accessToken: "ex_access_token",
  refreshToken: "ex_refresh_token",
} as const;
