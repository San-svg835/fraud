import "./globals.css";

export const metadata = {
  title: "FraudShield AI - Financial Fraud Detection Dashboard",
  description: "Machine-learning-based financial fraud detection and transaction risk scoring.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
