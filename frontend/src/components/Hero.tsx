// Hero.tsx
import React from 'react';
import './Hero.css';

const Hero: React.FC = () => {
  return (
    <section className="hero">
      <div className="hero-image">
        {/* Replace with actual image path */}
        <img src={"https://uptown-financials-images.s3.us-east-1.amazonaws.com/uptown_financials_skyscrapers.png"} alt="Skyscrapers" />
      </div>
      <div className="hero-text">
        <h1>Accountability is Absolute</h1>
        <p>Tailored-made accounting, financial, and strategic solutions</p>
      </div>
    </section>
  );
};

export default Hero;
