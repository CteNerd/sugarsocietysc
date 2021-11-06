import React from "react";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="main-nav-container">
          <nav className="main-nav">
            <div key="home" className="menu-item">
              Home
            </div>
            <div key="specials" className="menu-item">
              Specials
            </div>
            <div key="story" className="menu-item">
              Our Story
            </div>
            <div key="home" className="menu-item">
              <img className="nav-logo" src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society-sugar-cookies.png" />
            </div>
            <div key="cookies" className="menu-item">
              Our Cookies
            </div>
            <div key="order" className="menu-item">
              Order Inquiry
            </div>
            <div key="contact" className="menu-item">
              Contact Us
            </div>
          </nav>
        </div>
        <img
          src={
            "https://wellcall-app-cdk.s3.amazonaws.com/winter-sugarcookies.jpg"
          }
          className="App-logo"
          alt="logo"
        />
      </header>
      <body className="App-body">
        <p>Website Coming Soon!!!</p>
        <a className="App-link" href="mailto:ashuah.tomlin@sugarsocietysc.com">
          Contact Us Now
        </a>
      </body>
      <footer>
        <a className="App-link" href="tel:+1254-313-3972">
          Call Us Now
        </a>
      </footer>
    </div>
  );
}

export default App;
