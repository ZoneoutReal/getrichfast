// Thin wrapper around ExtPay for extension pages.
// When CLIPSTACK_CONFIG.EXTPAY_ID is null the extension behaves as free-only.
globalThis.ClipStackPay = (() => {
  const id = globalThis.CLIPSTACK_CONFIG.EXTPAY_ID;
  const extpay = id && typeof ExtPay === "function" ? ExtPay(id) : null;

  return {
    configured: !!extpay,
    async getStatus() {
      if (!extpay) return { configured: false, paid: false };
      try {
        const user = await extpay.getUser();
        return { configured: true, paid: !!user.paid, email: user.email || null };
      } catch {
        // Offline or ExtensionPay unreachable — fail closed to free tier.
        return { configured: true, paid: false, error: true };
      }
    },
    openPaymentPage() {
      if (extpay) extpay.openPaymentPage();
    },
    openLoginPage() {
      if (extpay) extpay.openLoginPage();
    }
  };
})();
