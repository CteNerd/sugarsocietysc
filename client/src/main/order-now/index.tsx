import React from "react";
import "./order-now.css";

export default function OrderNow() {
  return (
    <div>
      <div>
        <h1>Order Now</h1>
        <p>
          Please complete the short form below and attach a completed order form
          to your submission. We strive to respond within 24 hours to all order
          request
        </p>
      </div>
      <div>
        <p>Download Form then attach to Order Submission</p>
        <a href="">
          <button>Valentine's Day Order Form</button>
        </a>
        <a href="">
          <button>Custom Order Form</button>
        </a>
      </div>
      <div className="contact-us-form-container">
        <a href="https://forms.gle/Rp9JpVfMj3XpV3FN7" target={"_blank"}>
          <button>Submit Order</button>
        </a>
      </div>
    </div>
  );
}
