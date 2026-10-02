import React from "react";
import { Link } from "react-router-dom";
import "./order-now.css";

export default function OrderNow() {
  return (
    <div className="order-now-page-container">
      <div className="order-now-intro">
        <h1>Order Now</h1>
        <p>
          Please complete the short form below and attach a completed order form
          to your submission. We strive to respond within 3 business days to all
          order requests.
        </p>
      </div>
      <div className="order-now-instructions">
        <p>
          Have a question about a custom order or need help with your submission?
          <br />
          <Link to="/contact">Contact us</Link> and we&apos;ll be happy to help.
        </p>
      </div>
    </div>
  );
}
