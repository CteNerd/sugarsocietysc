import React from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home";
import OurStory from "./main/home";
import Specials from "./main/home";
import OurCookies from "./main/home";
import OrderInquiry from "./main/home";
import Contact from "./main/home";
import { FacebookOutlined, InstagramOutlined } from "@ant-design/icons";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="main-nav-container">
            <nav className="main-nav">
              <div key="home" className="menu-item">
                Home
              </div>
              <div key="story" className="menu-item">
                Our Story
              </div>
              <div key="specials" className="menu-item">
                Specials
              </div>
              <div key="home" className="menu-item">
                <img
                  className="nav-logo"
                  src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society-sugar-cookies.png"
                />
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
        <body className="App-body-container">
          <div className="App-body">
            <Switch>
              <Route path="/our-story">
                <OurStory />
              </Route>
              <Route path="/specials">
                <Specials />
              </Route>
              <Route path="/our-cookies">
                <OurCookies />
              </Route>
              <Route path="/order-inquiry">
                <OrderInquiry />
              </Route>
              <Route path="/contact">
                <Contact />
              </Route>
              <Route path="/">
                <Home />
              </Route>
            </Switch>
          </div>
        </body>
        <footer>
          <a
            className="App-link"
            href="mailto:ashuah.tomlin@sugarsocietysc.com"
          >
            Contact Us Now
          </a>
          <a
            href="https://www.facebook.com/Sugar-Society-Sugar-Cookies-105693268589749"
            target="_blank"
          >
            <FacebookOutlined />
          </a>
          <a href="https://www.instagram.com/sugarsocietysc/" target="_blank">
            <InstagramOutlined />
          </a>
          <a className="App-link" href="tel:+1254-313-3972">
            Call Us Now
          </a>
        </footer>
      </div>
    </Router>
  );
}

export default App;
