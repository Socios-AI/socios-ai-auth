export type AuthErrorCode =
  | "EXPIRED"
  | "INVALID"
  | "MISSING_TOKEN"
  | "API_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "RATE_LIMITED";

export type MfaErrorCode =
  | "INVALID_CODE"
  | "EXPIRED"
  | "RATE_LIMITED"
  | "NO_FACTOR"
  | "API_ERROR";
