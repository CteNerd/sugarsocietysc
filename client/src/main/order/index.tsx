import React, { useEffect } from "react";
import sgMail from "@sendgrid/mail";

export default function OrderInquiry() {
  return (
    <div>
      <h1>Order via Email</h1>
      <div>
        <p>
          Feel free to take a look around our site and get inspiration for your
          cookie ideas. Once you have decided on what kind of cookie(s) you are
          looking for, please feel it out the order form by clicking the button
          below. Once your order is received, we will contact you to go over
          details for the order.
        </p>
        <a href="https://forms.gle/CRWM3HZjvuvrjADR6" target="_blank">
          <button>Order Now</button>
        </a>
      </div>
    </div>
  );
}
