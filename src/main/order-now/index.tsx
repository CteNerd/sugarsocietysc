import React from "react";
import moment from "moment";
import "./order-now.css";

export default function OrderNow() {
  const envVar = process.env.TEST_STRING;
  return (
    <div className="order-now-page-container">
      <div>
        <h1>Order Now</h1>
        <p>
          Please complete the short form below and attach a completed order form
          to your submission. We strive to respond within 3 business days to all
          order request
        </p>
      </div>
      <div>
        <div>
          <a href="https://form.asana.com/?k=sqIbI7gwO8vlHmCyYiD05Q&d=1203037369805982&embed=true">
            <button>Custom Order Form</button>
          </a>
        </div>
        <div hidden={moment().isAfter('2023-08-04T10:00')}>
          <a href="https://form.asana.com/?k=N-XZLjCajHKHp-mh-Wokjw&d=1203037369805982&embed=true">
            <button>Back 2 School Order Form</button>
          </a>
        </div>
      </div>
      <b>{envVar}</b>
    </div>
  );
}
