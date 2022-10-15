import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home";
import OurStory from "./main/story";
import Specials from "./main/specials";
import OurCookies from "./main/cookies";
import CreateInvoice from "./main/invoice/create-invoice";
import OrderNow from "./main/order-now";
import {
  FacebookOutlined,
  GoogleOutlined,
  InstagramOutlined,
} from "@ant-design/icons";
import "./App.css";
import SideNav from "./main/sideNav/sideNav";
import Contact from "./main/contact";
import Pricing from "./main/pricing";
import { NotificationContainer } from "react-notifications";
import "react-notifications/lib/notifications.css";
import PrivacyPolicy from "./main/privacy/privacy-policy";
import OrderForm from "./main/order/order-form";

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
          <div key="home" className="menu-item col-1">
            <a href="/">Home</a>
          </div>
          <div key="story" className="menu-item col-1">
            <a href="/our-story">Our Story</a>
          </div>
          <div key="specials" className="menu-item col-1">
            <a href="/specials">Specials</a>
          </div>
          <div key="logo" className="menu-item col-3">
            <a href="/">
              <img
                className="nav-logo"
                src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society-sugar-cookies.png"
              />
            </a>
          </div>
          <div key="cookies" className="menu-item col-1">
            <a href="/our-cookies">Our Cookies</a>
          </div>
          <div key="order" className="menu-item col-1">
            <a href="/pricing">Pricing</a>
          </div>
          <div key="order-form" className="menu-item col-1">
            <a href="/order-form">Order Form</a>
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
        <NotificationContainer />
        <body className="App-body-container">
          <div className="App-body">
            <div className="page-content-container">
              <Switch>
                <Route path="/our-story">
                  <OurStory />
                </Route>
                <Route path="/specials">
                  <Specials isMobile={isMobile} />
                </Route>
                <Route path="/our-cookies">
                  <OurCookies isMobile={isMobile} />
                </Route>
                <Route path="/pricing">
                  <Pricing />
                </Route>
                <Route path="/order-now">
                  <OrderNow />
                </Route>
                <Route path="/order-form">
                  <OrderForm />
                </Route>
                <Route path="/contact">
                  <Contact />
                </Route>
                <Route path="/privacy">
                  <PrivacyPolicy />
                </Route>
                <Route path="/create-invoice">
                  <CreateInvoice />
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
            <a
              className="social-link"
              href="https://g.page/r/CdDfLKquRwTPEAo"
              target="_blank"
            >
              <GoogleOutlined />
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
