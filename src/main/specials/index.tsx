import React from "react";
import "./specials.css";
import Cookies from "../cookies/cookies-json/2022-christmas-cookies.json";

interface Props {
  isMobile: boolean;
}

export default function Specials(props: Props) {
  function SpecialCookies() {
    let content: JSX.Element[] = [];

    Cookies.forEach((cookie, index) => {
      let price = "";

      if (cookie.price.giftSet) {
        price = `Gift Set: $${cookie.price.giftSet}`;
      } else if (cookie.price.each) {
        price = `Each: $${cookie.price.each} or Two Dozen : $${cookie.price.TwoDozen}`;
      }

      content.push(
        <div
          className={"card-img-container"}
          style={{ width: props.isMobile ? "50%" : "33%" }}
        >
          <img src={cookie.url} className={"card-img"} />
          <div className="special-cookie-title">{cookie.caption}</div>
          <div className="special-cookie-description">{price}</div>
        </div>
      );
    });

    return <div>{content}</div>;
  }

  return (
    <div>
      <div>
        <img
          className="specials-img"
          src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/ads/2022/Christmas+2022+Cookie+Menu.jpg"
        />
        <div className="row">
          <SpecialCookies />
        </div>
        <a href="/order-now">
          <button>Order Now</button>
        </a>
      </div>
    </div>
  );
}
