import React, { useState } from "react";
import "./specials.css";
import Cookies from "../cookies/cookies-json/2023-valentines-cookies.json";

interface Props {
  isMobile: boolean;
}

// Detect genuinely hover-capable pointers (mouse/trackpad) so the tap-to-expand
// fallback only activates for touch/coarse pointers; otherwise a desktop click would
// leave a card stuck open after the mouse moves away, fighting the CSS :hover effect.
function supportsHover(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

export default function Specials(props: Props) {
  // `:hover` doesn't fire reliably (and can get "stuck") on touch devices, so tapping a
  // card toggles the same enlarge-on-hover effect via this class instead (see specials.css).
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  function toggleExpanded(url: string) {
    setExpandedUrl((current) => (current === url ? null : url));
  }

  function handlePointerClick(url: string) {
    if (supportsHover()) {
      // Hover-capable pointers (mouse/trackpad) already get the effect from CSS :hover;
      // ignore the click so state can't get stuck open after the pointer leaves. Keyboard
      // activation (below) is never gated, since keyboard-only users can't trigger :hover.
      return;
    }
    toggleExpanded(url);
  }

  // Rendered inline (not as a nested component) so React reconciles the existing DOM
  // nodes on state updates instead of remounting the whole grid, which would otherwise
  // discard keyboard focus every time a card is toggled via Enter/Space.
  function renderSpecialCookies() {
    const content = Cookies.map((cookie) => {
      const isExpanded = expandedUrl === cookie.url;
      return (
        <div
          key={cookie.url}
          role="button"
          tabIndex={0}
          aria-pressed={isExpanded}
          aria-label={`${
            cookie.caption || "Special cookie design"
          } - tap or press enter to enlarge`}
          className={"card-img-container" + (isExpanded ? " card-expanded" : "")}
          style={{ width: props.isMobile ? "50%" : "33%" }}
          onClick={() => handlePointerClick(cookie.url)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleExpanded(cookie.url);
            }
          }}
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
        <div className="row">{renderSpecialCookies()}</div>
        <a href="/order-now">
          <button>Order Now</button>
        </a>
      </div>
    </div>
  );
}
