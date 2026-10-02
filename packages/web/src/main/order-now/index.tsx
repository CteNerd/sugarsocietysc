import React from "react";
import { Link } from "react-router-dom";
import "./order-now.css";

export default function OrderNow() {
  return (
    <div className="order-now-page-container">
      <div className="order-now-intro">
        <h1>Order Now</h1>
        <p>
          For custom cookie orders, use our Contact form and tell us the occasion,
          quantity, requested date, and design details. We strive to respond
          within 3 business days.
        </p>
      </div>
      <div className="order-now-instructions">
        <p>
          Ready to discuss a custom order?{' '}
          <Link to="/contact">Send us your order details</Link> and we&apos;ll be happy to help.
        </p>
      </div>
    </div>
  );
}
