import React from "react";
import './specials.css'

export default function Specials() {
  return (
    <div>
      <div>
        <h1>Looking for the specials?</h1>
        <div className="specials-header">
          <img className="specials-img" src="https://wellcall-app-cdk.s3.amazonaws.com/thank-you-scrabble.jpg" />
          <p className="specials-context">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>
        <a href="/order-inquiry">
          <button>Order Now</button>
        </a>
      </div>
    </div>
  );
}
