import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Home from "./main/home";
import OurStory from "./main/story";
import Specials from "./main/specials";
import OurCookies from "./main/cookies";
import CreateInvoice from "./main/invoice/create-invoice";
import OrderNow from "./main/order-now";
import PreSale from "./main/presale";
import EventOrder from "./main/presale/EventOrder";
import "./App.css";
import Navigation from "./components/Navigation";
import Contact from "./main/contact";
import PrivacyPolicy from "./main/privacy/privacy-policy";
import OrderForm from "./main/order/order-form";
import NotFound from "./main/error/NotFound";
import Signup from "./main/auth/Signup";
import Confirm from "./main/auth/Confirm";
import Login from "./main/auth/Login";
import Account from "./main/auth/Account";
import GoogleCallback from "./main/auth/GoogleCallback";
import Unsubscribe from "./main/newsletter/Unsubscribe";
import NewsletterSignup from "./components/NewsletterSignup";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminProtectedRoute from "./auth/AdminProtectedRoute";
import AdminDashboard from "./main/AdminDashboard";
import OrderHistory from "./main/OrderHistory";

function App() {
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 1279px)").matches
  );

  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 1279px)");
    const updateIsMobile = () => setIsMobile(breakpoint.matches);
    breakpoint.addEventListener("change", updateIsMobile);
    return () => breakpoint.removeEventListener("change", updateIsMobile);
  }, []);

  return (
    <HelmetProvider>
      <AuthProvider>
      <Router>
        <div className="App">
          <header className="App-header">
            <div className="main-nav-container">
              <Navigation isMobile={isMobile} />
            </div>
          </header>
          <main className="App-body-container">
            <div className="App-body">
              <div className="page-content-container">
                <Routes>
                  <Route path="/our-story" element={<OurStory />} />
                  <Route path="/specials" element={<Specials isMobile={isMobile} />} />
                  <Route path="/our-cookies" element={<OurCookies isMobile={isMobile} />} />
                  {/* <Route path="/pricing" element={<Pricing />} /> */}
                  <Route path="/order-now" element={<OrderNow />} />
                  <Route path="/pre-sale" element={<PreSale />} />
                  <Route path="/presale/:eventId" element={<EventOrder />} />
                  <Route path="/order-form" element={<OrderForm />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/create-invoice" element={<CreateInvoice />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/confirm" element={<Confirm />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth/callback" element={<GoogleCallback />} />
                  <Route path="/newsletter-unsubscribe" element={<Unsubscribe />} />
                  <Route
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <Account />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute>
                        <OrderHistory />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <AdminProtectedRoute>
                        <AdminDashboard />
                      </AdminProtectedRoute>
                    }
                  />
                  <Route path="/" element={<Home isMobile={isMobile} />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </div>
          </main>
        <footer>
          <div className="footer-link-container">
            <NewsletterSignup />
          </div>
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
              rel="noopener noreferrer"
              aria-label="Visit our Facebook page"
            >
              <span aria-hidden="true">f</span>
              <span>Facebook</span>
            </a>

            <a
              className="social-link"
              href="https://www.instagram.com/sugarsocietysc/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit our Instagram page"
            >
              <span aria-hidden="true">◎</span>
              <span>Instagram</span>
            </a>
            <a
              className="social-link"
              href="https://g.page/r/CdDfLKquRwTPEAo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit our Google Business page"
            >
              <span aria-hidden="true">G</span>
              <span>Google Business</span>
            </a>
          </div>
          <div className="footer-link-container">
            <a className="footer-link" href="tel:+1254-313-3972">
              Call Us Now
            </a>
          </div>
          <div className="footer-link-container">
            <Link className="footer-link" to="/privacy">Privacy Policy</Link>
          </div>
          <div className="footer-link-container">
            <p className="footer-copyright">
              © {new Date().getFullYear()} Sugar Society Sugar Cookies | A Black-owned business in Rosharon, TX serving the greater
              Houston area
            </p>
          </div>
        </footer>
      </div>
    </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
