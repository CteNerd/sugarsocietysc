import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home";
import OurStory from "./main/story";
import Specials from "./main/specials";
import OurCookies from "./main/cookies";
import OrderInquiry from "./main/order";
import Contact from "./main/contact";
import { FacebookOutlined, InstagramOutlined } from "@ant-design/icons";
import "./App.css";
import SideNav from "./main/sideNav/sideNav";

function App() {
  const breakpoint = window.matchMedia("(max-width: 1279px)");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(breakpoint.matches);
  }, []);

  /* Set the width of the side navigation to 250px */
  function openNav() {
    if (document.getElementById("mySidenav")) {
      document.getElementById("mySidenav")!.style.width = "250px";
    }
  }

  function Navigation() {
    if (isMobile) {
      return (
        <div className="col-33 menu-btn" onClick={() => openNav()}>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </div>
      );
    } else {
      return (
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
      );
    }
  }
  return (
    <Router>
      <div className="App">
        <SideNav />
        <header className="App-header">
          <div className="main-nav-container">
            <Navigation />
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
                  <OurCookies isMobile />
                </Route>
                <Route path="/order-inquiry">
                  <OrderInquiry />
                </Route>
                <Route path="/contact">
                  <Contact />
                </Route>
                <Route path="/">
                  <Home isMobile />
                </Route>
              </Switch>
            </div>
          </div>
        </body>
        <footer>
          <div className="footer-link-container">
            <a className="footer-link" href="/contact">
              Contact Us Now
            </a>
          </div>
          <div className="footer-link-container">
            <a
              className="social-link"
              href="https://www.facebook.com/Sugar-Society-Sugar-Cookies-105693268589749"
              target="_blank"
            >
              <FacebookOutlined />
            </a>

            <a
              className="social-link"
              href="https://www.instagram.com/sugarsocietysc/"
              target="_blank"
            >
              <InstagramOutlined />
            </a>
          </div>
          <div className="footer-link-container">
            <a className="footer-link" href="tel:+1254-313-3972">
              Call Us Now
            </a>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
