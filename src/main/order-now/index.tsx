import React from "react";
import moment from "moment";
import "./order-now.css";

export default function OrderNow() {
  const envVar = process.env.REACT_APP_TEST_STRING;
  const nodeVar = process.env.NODE_ENV;
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
        <div hidden={moment().isAfter('2024-05-02T10:00')}>
          <a href="https://form.asana.com/?k=owkK4jB4PDvEKDLF8yLKPw&d=1203037369805982&embed=true">
            <button>Teacher Appreciation Order Form</button>
          </a>
        </div>
        <div hidden={moment().isAfter('2024-05-02T10:00')}>
          <a href="https://form.asana.com/?k=jGSIiPTFw-L9E4WDOHPjoQ&d=1203037369805982&embed=true">
            <button>Nurse Appreciation Order Form</button>
          </a>
        </div>
        <div hidden={moment().isAfter('2024-05-21T10:00')}>
          <a href="https://form.asana.com/?k=3yWhVUKnVtUMRxnXin66Hw&d=1203037369805982&embed=true">
            <button>'24 Graduation Order Form</button>
          </a>
        </div>
      </div>
      <h1>{envVar}</h1>
      <h1>{nodeVar}</h1>
    </div>
  );
}
