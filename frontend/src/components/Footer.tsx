// Footer.tsx
import React, { useState } from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission logic
    console.log('Subscribed with:', email);
  };

  return (
    <footer className="footer">
      <div className="footer-left">
        <h3>Uptown Accounting Group</h3>
      </div>
      <div className="footer-right">
        <div className="footer-middle">
          <p>704-910-6147</p>
          <p>admin@uptownaccountinggroup.com</p>
          <p>6047 Tyvola Glen Circle Charlotte, NC 28217</p>
        </div>
        <h4>Subscribe to Our Newsletter</h4>
        <form onSubmit={handleSubmit} className="newsletter-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Your Email *"
            required
          />
          <button type="submit">Subscribe</button>
        </form>
      </div>
    </footer>
  );
};

export default Footer;
