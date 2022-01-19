import React from "react";
import "./specials.css";

interface Props {
  isMobile: boolean;
}

export default function Specials(props: Props) {
  return (
    <div>
      <div>
        <h1>Looking for the specials?</h1>
        <img
          className="specials-img"
          src="https://wellcall-app-cdk.s3.amazonaws.com/Valentines+Pre-Order+Menu.jpg"
        />
        <a href="/order-now">
          <button>Order Now</button>
        </a>
      </div>
    </div>
  );
}
