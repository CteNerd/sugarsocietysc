import React from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/SEO";
import "./error.css";

export default function NotFound() {
  return (
    <>
      <SEO
        title="Page Not Found | Sugar Society Sugar Cookies"
        description="Sorry, the page you're looking for cannot be found. Browse our custom sugar cookies for birthdays, weddings, and special events in Houston, TX."
        pathname="/404"
      />
      <section className="not-found-section">
        <h1>Page Not Found</h1>
        <p>Sorry, the page you're looking for doesn't exist or has been moved.</p>
        <div className="error-links">
          <Link to="/" className="home-link">Return to Home Page</Link>
          <Link to="/our-cookies" className="cookies-link">View Our Cookie Gallery</Link>
          <Link to="/order-now" className="order-link">Order Custom Cookies</Link>
        </div>
        <div className="contact-suggestion">
          <p>Looking for something specific? <Link to="/contact">Contact us</Link> for assistance.</p>
        </div>
      </section>
    </>
  );
}
