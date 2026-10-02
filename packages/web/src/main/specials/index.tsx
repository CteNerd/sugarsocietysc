import React, { useState } from "react";
import "./specials.css";
import Cookies from "../cookies/cookies-json/2023-valentines-cookies.json";

interface Props {
  isMobile: boolean;
}

export default function Specials(props: Props) {
  // `:hover` doesn't fire reliably on touch devices, so tapping a card toggles the same
  // enlarge-on-hover effect via this class instead (see specials.css).
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  function SpecialCookies() {
    let content: JSX.Element[] = [];

    Cookies.forEach((cookie) => {
      content.push(
        <div
          key={cookie.url}
          className={
            "card-img-container" +
            (expandedUrl === cookie.url ? " card-expanded" : "")
          }
          style={{ width: props.isMobile ? "50%" : "33%" }}
          onClick={() =>
            setExpandedUrl((current) =>
              current === cookie.url ? null : cookie.url
            )
          }
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
