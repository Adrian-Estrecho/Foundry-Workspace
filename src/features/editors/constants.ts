/** Onboarding steps editors tick themselves (Foundry can't check them). */
export const SELF_REPORTED_STEPS = ["frameio", "asset_pack"] as const;

/** Steps that tick themselves, with the reason shown in the UI. */
export const AUTO_STEP_HINTS: Record<string, string> = {
  contract_nda: "Ticks itself when both the signed contract and the NDA are uploaded",
  payment_details: "Ticks itself when payment details are saved",
  sops: "Ticks itself when every required SOP is marked as read",
  trial_task: "Ticks itself when an admin approves the trial task",
};

export const DOC_TYPES = [
  { value: "contract", label: "Signed contract" },
  { value: "nda", label: "Signed NDA" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["value"];

/** Payment methods and the fields each one asks for (stored as JSON). */
export const PAYMENT_METHODS = {
  bank: {
    label: "Bank transfer",
    fields: [
      { key: "account_name", label: "Account holder", required: true },
      { key: "bank_name", label: "Bank", required: true },
      { key: "account_number", label: "Account number or IBAN", required: true },
      { key: "routing", label: "Routing, sort code or SWIFT/BIC", required: false },
      { key: "country", label: "Bank country", required: true },
    ],
  },
  wise: {
    label: "Wise",
    fields: [
      { key: "email", label: "Wise account email", required: true },
      { key: "currency", label: "Currency", required: false },
    ],
  },
  paypal: {
    label: "PayPal",
    fields: [{ key: "email", label: "PayPal email", required: true }],
  },
  other: {
    label: "Other",
    fields: [{ key: "instructions", label: "How should we pay you?", required: true }],
  },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const isPaymentMethod = (value: string): value is PaymentMethod => value in PAYMENT_METHODS;

export const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 7, short: "Sun" },
] as const;
