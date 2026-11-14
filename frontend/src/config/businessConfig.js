/**
 * Kabir's Kitchen Business & Contact Configuration
 * Update phone numbers, bKash/Nagad accounts, or address here in one central place.
 */
export const BUSINESS_CONFIG = {
  name: "Kabir's Kitchen",
  tagline: "Artisanal Dining & Cake Boutique",
  phone: "01791665634",
  phoneDisplay: "01791665634",
  whatsapp: "8801791665634",
  get whatsappUrl() {
    return `https://wa.me/${this.whatsapp}?text=${encodeURIComponent("Hello Kabir's Kitchen! I have an inquiry about an order.")}`;
  },
  paymentAccounts: {
    bkash: {
      name: "bKash (বিকাশ)",
      number: "01791665634",
      type: "Personal / Merchant",
      color: "#d946ef"
    },
    nagad: {
      name: "Nagad (নগদ)",
      number: "01791665634",
      type: "Send Money",
      color: "#f97316"
    },
    rocket: {
      name: "Rocket (রকেট)",
      number: "01791665634",
      type: "Send Money",
      color: "#8b5cf6"
    }
  },
  address: "Dhanmondi, Dhaka, Bangladesh",
  hours: "11:00 AM - 11:00 PM (Daily)"
};

