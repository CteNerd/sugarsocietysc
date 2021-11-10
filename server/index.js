const express = require('express'); //Line 1
const sgMail = require('@sendgrid/mail');
const app = express(); //Line 2
const port = process.env.PORT || 5000; //Line 3

// create a GET route
app.get('/express_backend', (req, res) => { //Line 9
    res.send({ express: 'YOUR EXPRESS BACKEND IS CONNECTED TO REACT' }); //Line 10
  }); //Line 11


// create a GET route
app.post('/api/send', (req, res) => {
    sgMail.setApiKey('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');
    const msg = {
      to: 'rtomlin62@gmail.com.com',
      from: 'admin@sugarsocietysc.com', // Use the email address or domain you verified above
      subject: 'Sending with Twilio SendGrid is Fun',
      text: 'and easy to do anywhere, even with Node.js',
      html: '<strong>and easy to do anywhere, even with Node.js</strong>',
    };
    // //ES6
    // sgMail
    //   .send(msg)
    //   .then(() => {}, error => {
    //     console.error(error);
    
    //     if (error.response) {
    //       console.error(error.response.body)
    //       res.send({ express: error.response.body }); //Line 10
    //     }
    //     res.send({ express: 'YOUR EXPRESS BACKEND IS CONNECTED TO REACT' }); //Line 10
    //   });
    //ES8
    (async () => {
      try {
        console.log('sendgrid is trying')
        await sgMail.send(msg);
      } catch (error) {
        console.error(error);
    
        if (error.response) {
          console.error(error.response.body)
          res.send({ express: error.response.body }); //Line 10
        }
      }
      console.log('sendgrid tried')
      res.send({ express: 'YOUR EXPRESS BACKEND IS CONNECTED TO REACT' }); //Line 10
    })();
  });
  

// This displays message that the server running and listening to specified port
app.listen(port, () => console.log(`Listening on port ${port}`)); //Line 6