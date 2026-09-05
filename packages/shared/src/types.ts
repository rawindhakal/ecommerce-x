export interface JwtPayload {
  sub: string; // user id
  role: string;
  phone?: string | null;
  email?: string | null;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaymentInitiateResult {
  gateway: string;
  mode: "REDIRECT_FORM" | "QR" | "COD";
  redirectUrl?: string;
  formFields?: Record<string, string>;
  qrPayload?: string;
  referenceId: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  raw?: unknown;
  message?: string;
}
