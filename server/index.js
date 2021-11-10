const express = require('express'); //Line 1
const sgMail = require('@sendgrid/mail');
const app = express(); //Line 2
const port = process.env.PORT || 5000; //Line 3

// This displays message that the server running and listening to specified port
app.listen(port, () => console.log(`Listening on port ${port}`)); //Line 6

// create a GET route
app.get('/express_backend', (req, res) => { //Line 9
    res.send({ express: 'YOUR EXPRESS BACKEND IS CONNECTED TO REACT' }); //Line 10
  }); //Line 11


// create a GET route
app.get('/api/send', (req, res) => {
    console.log(process.env.SENDGRID_API_KEY);
    res.send({ express: 'FINALLY MADE IT SOMEWHERE' }); //Line 10
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // const msg = {
    //   to: 'admin@sugarsocietysc.com',
    //   from: 'admin@sugarsocietysc.com', // Use the email address or domain you verified above
    //   subject: 'Sending with Twilio SendGrid is Fun',
    //   text: 'and easy to do anywhere, even with Node.js',
    //   html: '<strong>and easy to do anywhere, even with Node.js</strong>',
    // };
    // //ES6
    // sgMail
    //   .send(msg)
    //   .then(() => {}, error => {
    //     console.error(error);
    
    //     if (error.response) {
    //       console.error(error.response.body)
    //     }
    //   });
    // //ES8
    // (async () => {
    //   try {
    //     await sgMail.send(msg);
    //   } catch (error) {
    //     console.error(error);
    
    //     if (error.response) {
    //       console.error(error.response.body)
    //     }
    //   }
    // })();
  });
  