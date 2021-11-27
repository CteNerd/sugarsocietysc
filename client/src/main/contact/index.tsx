import React from "react";
import "./contact.css";

export default function Contact() {
  return (
    <div>
      <div>
        <h1>Contact Us Anytime</h1>
        <p>
          Thank you so much for reaching out to us regarding an order! We are in
          Rosharon, Texas, and offer services to the greater Houston area for local
          pick up or delivery. Please contact us with any pricing or cookie
          designs that are not featured on our website. If you are ready to
          place an order, please head over to the{" "}
          {<a href="/order-inquiry">Order Now</a>} page and complete the order
          form.
        </p>
      </div>
      <div className="contact-us-form-container">
        <iframe
          className="contact-us-form"
          src="https://cdn.forms-content.sg-form.com/3225ef5a-3eb2-11ec-bf9a-76b27561ebce"
        />
      </div>
    </div>
  );
}
