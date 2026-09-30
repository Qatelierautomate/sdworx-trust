export const COUNTRIES = [
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Hungary",
  "Ireland",
  "Italy",
  "Luxembourg",
  "Mauritius",
  "Netherlands",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
] as const;

export const CUSTOMER_TYPES = ["SME", "Mid-Market", "Enterprise"] as const;

export const PRODUCTS = ["Payroll", "HR", "Time & attendance"] as const;

export const EMPLOYEE = {
  firstName: "Emma",
  fullName: "Emma V.",
  initials: "EV",
  role: "Payroll advisor",
  location: "Belgium",
  email: "emma.v@sdworx.com",
} as const;
