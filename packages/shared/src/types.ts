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
  // The gateway's own echo of the transaction reference we originally sent
  // it (e.g. eSewa's transaction_uuid, CyberSource's req_transaction_uuid).
  // A signature can be genuinely valid yet describe a *different* payment
  // than the one the caller is trying to finalize — the caller must check
  // this equals the expected payment's referenceId before trusting `success`.
  referenceId?: string;
  amount?: number;
  raw?: unknown;
  message?: string;
}
