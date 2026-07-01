import Link from "next/link";

export const metadata = {
  title: "Payment Failed | Skanare",
  description: "Your Skanare payment could not be completed.",
};

export default function PaymentFailurePage() {
  return (
    <main className="payment-page">
      <div className="payment-card failed">
        <div className="payment-icon">❌</div>

        <h1>Payment Failed</h1>

        <p>Unfortunately your payment could not be completed.</p>
        <p>No money has been charged.</p>
        <p>Please try again or use another payment method.</p>

        <div className="payment-actions">
          <Link href="/checkout" className="btn-primary">
            Try Again
          </Link>

          <Link href="/cart" className="btn-secondary">
            Return to Cart
          </Link>
        </div>
      </div>
    </main>
  );
}
