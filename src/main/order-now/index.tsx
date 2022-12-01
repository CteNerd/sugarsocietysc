import React from "react";
import "./order-now.css";

export default function OrderNow() {
  return (
    <div className="order-now-page-container">
      <div>
        <h1>Order Now</h1>
        <p>
          Please complete the short form below and attach a completed order form
          to your submission. We strive to respond within 24 hours to all order
          request
        </p>
      </div>
      <div className="asana-embed-container">
        <link
          rel="stylesheet"
          href="https://form.asana.com/static/asana-form-embed-style.css"
        />
        <iframe
          className="asana-embed-iframe"
          height="533"
          width="800"
          src="https://form.asana.com/?k=COrL0VvOnsm2jAGEHmonHw&d=1203037369805982&embed=true"
        ></iframe>
        <div className="asana-embed-footer">
          <a
            rel="nofollow noopener"
            target="_blank"
            className="asana-embed-footer-link"
            href="https://asana.com/?utm_source=embedded_form"
          >
            <span className="asana-embed-footer-text">Form powered by</span>
            <div
              className="asana-embed-footer-logo"
              role="img"
              aria-label="Logo of Asana"
            ></div>
          </a>
        </div>
      </div>
    </div>
  );
}
