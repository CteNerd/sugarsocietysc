import React from "react";
import sgMail from '@sendgrid/mail'

export default function OrderInquiry() {
sgMail.setApiKey('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');

function TrySending() {
  console.log('we are trying');
  const msg = {
    to: 'admin@sugarsocietysc.com',
    from: 'no-reply@sugarsocietysc.com', // Use the email address or domain you verified above
    subject: 'Sending with Twilio SendGrid is Fun',
    text: 'and easy to do anywhere, even with Node.js',
    html: '<strong>and easy to do anywhere, even with Node.js</strong>',
  };
  //ES6
  sgMail
    .send(msg)
    .then(() => {}, error => {
      console.error(error);
  
      if (error.response) {
        console.error(error.response.body)
      }
    });
  //ES8
  (async () => {
    try {
      await sgMail.send(msg);
    } catch (error: any) {
      console.error(error);
  
      if (error.response) {
        console.error(error.response.body)
      }
    }
  })();
  console.log('we tried');
}

  return (
    <div>
      <h1>Order via Email</h1>
      <div onClick={() => {TrySending()}}>
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
    </div>
  );
}
