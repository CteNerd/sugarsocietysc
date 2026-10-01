import React from "react";
import "./specials.css";
import Cookies from "../cookies/cookies-json/2023-valentines-cookies.json";

interface Props {
  isMobile: boolean;
}

export default function Specials(props: Props) {
  function SpecialCookies() {
    let content: JSX.Element[] = [];

    Cookies.forEach((cookie) => {
      content.push(
        <div
          key={cookie.url}
          className={"card-img-container"}
          style={{ width: props.isMobile ? "50%" : "33%" }}
        >
          <img
            src={cookie.url}
            className={"card-img"}
            alt={cookie.caption || "Special cookie design"}
          />
          <div className="special-cookie-title">{cookie.caption}</div>
          {/* <div className="special-cookie-description">{price}</div> */}
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
          src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/ads/2023/Pink+Blue+Illustrated+Hearts+Valentine's+Day+Food+and+Drink+Menu.jpg"
          alt="Valentine's Day cookie menu"
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
