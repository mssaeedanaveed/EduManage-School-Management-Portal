export interface PaymentGateway {
  createPaymentRequest(input: {
    amount: number;
    referenceNo: string;
    studentId: string;
    voucherId: string;
    callbackUrl: string;
  }): Promise<{ gatewayReference: string; checkoutUrl?: string }>;
  verifyCallback(payload: unknown): Promise<{ verified: boolean; referenceNo?: string; amount?: number }>;
}

export const paymentGatewayPlaceholder: PaymentGateway = {
  async createPaymentRequest() {
    throw new Error('No online payment gateway is configured.');
  },
  async verifyCallback() {
    return { verified: false };
  },
};
