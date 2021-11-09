import React from "react";
import "./cookies.css";

export default function OurCookies() {
  return (
    <div>
      <h1>Our Cookies</h1>
      <h2>
      Mmm Mmm Good... Say Less...
      </h2>
      <div className="row">
        <div className="column">
          <div className="card">
            <a
              href={
                "https://wellcall-app-cdk.s3.amazonaws.com/winter-sugarcookies.jpg"
              }
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Tech+Logo+No+Padding.png"
                }
                className={"card-img"}
              />
              <h3>{"Christmas Cookies"}</h3>
              <p>{"Just need a glass of milk and a tray just for Santa"}</p>
            </a>
          </div>
          <div className="card">
            <a
              href={
                "https://wellcall-app-cdk.s3.amazonaws.com/winter-sugarcookies.jpg"
              }
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Tech+Logo+No+Padding.png"
                }
                className={"card-img"}
              />
              <h3>{"Birthday Cookies"}</h3>
              <p>{"Making life a little sweeter for that special someone in your life"}</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
