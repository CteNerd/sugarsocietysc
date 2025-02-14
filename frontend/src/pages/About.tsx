// About.tsx
import React from 'react';
import './About.css';

const About: React.FC = () => {
  return (
    <section className="about">
      <div className="about-text">
        <h2>About</h2>
        <p>
          Uptown Accounting Group is a leading financial services provider with a strong commitment to delivering tailored financial solutions.
          Our team of experienced professionals is dedicated to helping businesses and individuals achieve financial success.
        </p>
        <p>
          Our team of accountants, quants, and technologists utilize best practices and creative business management developments to
          provide you a tailor-made financial service.
        </p>
      </div>
      <div className="about-image">
        {/* Replace with actual image path */}
        <img src={"https://uptown-financials-images.s3.us-east-1.amazonaws.com/uptown_financials_skyscrapers.png"} alt="Financial Expert Working" />
      </div>
    </section>
  );
};

export default About;
