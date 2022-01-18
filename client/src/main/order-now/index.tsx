import React from "react";
import "./order-now.css";

export default function OrderNow() {
  return (
    <div>
      <div>
        <h1>Contact Us Anytime</h1>
        <p>
          Complete Order Form Below.
        </p>
      </div>
      <div className="contact-us-form-container">
        <a href="https://forms.gle/Rp9JpVfMj3XpV3FN7" target={"_blank"}>
          <button>
            Submit Order
            </button>
        </a>
      </div>
    </div>
  );
}
