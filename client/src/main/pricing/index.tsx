import React, { useEffect } from "react";
import sgMail from "@sendgrid/mail";

export default function Pricing() {
  return (
    <div>
      <h1>Pricing</h1>
      <div>
        <p>
          Feel free to take a look around our site and get inspiration for your
          cookie ideas. Once you have decided on what kind of cookie(s) you are
          looking for, please download and complete one of the order forms
          below. Completed order forms can be sent via this{" "}
          {<a href="mailto:ashuah.tomlin@sugarsocietysc.com">link</a>}. Once
          your order is received, we will contact you to go over details for the
          order.
        </p>
      </div>
    </div>
  );
}
