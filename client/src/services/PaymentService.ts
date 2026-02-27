// Modular PaymentService placeholder for future UPI/backend integration

export interface PaymentRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  method: "upi" | "cash" | "debit" | "credit";
  groupId?: string;
  expenseId?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

export const PaymentService = {
  /**
   * Initiate a payment.
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise(resolve => setTimeout(resolve, 800));

    if (request.method === "upi") {
      // Generate UPI deep link placeholder
      const upiLink = `upi://pay?pa=example@upi&pn=FairPay&am=${request.amount}&cu=${request.currency}`;
      window.open(upiLink, "_blank");
      return { success: true, transactionId: `txn_${Date.now()}`, message: "UPI payment initiated" };
    }

    return { success: true, transactionId: `txn_${Date.now()}`, message: "Payment recorded successfully" };
  },

  /**
   * Request acknowledgement for cash payment
   */
  async requestAcknowledgement(transactionId: string): Promise<PaymentResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "Acknowledgement request sent" };
  },

  /**
   * Send settlement reminder
   */
  async sendReminder(userId: string, amount: number): Promise<PaymentResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "Reminder sent successfully" };
  },
};
