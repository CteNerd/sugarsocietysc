import React from "react";
import sgMail from "@sendgrid/mail";

export default function OrderInquiry() {
  sgMail.setApiKey(
    "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"
  );

  function TrySending() {
    console.log("we are trying");
    const msg = {
      to: "admin@sugarsocietysc.com",
      from: "admin@sugarsocietysc.com", // Use the email address or domain you verified above
      subject: "Sending with Twilio SendGrid is Fun",
      text: "and easy to do anywhere, even with Node.js",
      html: "<strong>and easy to do anywhere, even with Node.js</strong>",
    };
    //ES6
    sgMail.send(msg).then(
      () => {},
      (error) => {
        console.error(error);

        if (error.response) {
          console.error(error.response.body);
        }
      }
    );
    //ES8
    (async () => {
      try {
        await sgMail.send(msg);
      } catch (error: any) {
        console.error(error);

        if (error.response) {
          console.error(error.response.body);
        }
      }
    })();
    console.log("we tried");
  }

  React.useEffect(() => {
    fetch("/express_backend")
      .then((res) => res.json())
      .then((data) => console.log(data.message));
  }, []);

  const handleOnSubmit = async (e: any) => {
    console.log("handleOnSubmit");
    e.preventDefault();
    const res = await fetch("/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "rtomlin62@gmail.com",
        message: "something nice",
      }),
    });
    const text = await res.text();
    console.log(res.status, text);
    console.log("handled");
  };

  return (
    <div>
      <h1>Order via Email</h1>
      <div
        onClick={(e) => {
          handleOnSubmit(e);
        }}
      >
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </p>
      </div>
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSfe5AKc73RvRJwtDWmBo--o62GLJ_xmyHh0ZTmxQ_PxMDFpJg/viewform?embedded=true"
          width="640"
          height="1242"
        >
        </iframe>
    </div>
  );
}
