import React from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home";
import OurStory from "./main/story";
import Specials from "./main/specials";
import OurCookies from "./main/cookies";
import OrderInquiry from "./main/order";
import Contact from "./main/contact";
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
                <a href="/">Home</a>
              </div>
              <div key="story" className="menu-item">
                <a href="/our-story">Our Story</a>
              </div>
              <div key="specials" className="menu-item">
                <a href="/specials">Specials</a>
              </div>
              <div key="home" className="menu-item">
                <img
                  className="nav-logo"
                  src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society-sugar-cookies.png"
                />
              </div>
              <div key="cookies" className="menu-item">
                <a href="/our-cookies">Our Cookies</a>
              </div>
              <div key="order" className="menu-item">
                <a href="/order-inquiry">Order Inquiry</a>
              </div>
              <div key="contact" className="menu-item">
                <a href="/contact">Contact Us</a>
              </div>
            </nav>
          </div>
        </header>
        <body className="App-body-container">
          <div className="App-body">
            <div className="page-content-container">
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
