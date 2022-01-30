import React from "react";
import "./specials.css";

interface Props {
  isMobile: boolean;
}

export default function Specials(props: Props) {
  return (
    <div>
      <div>
        <img
          className="specials-img"
          src="https://wellcall-app-cdk.s3.amazonaws.com/Valentines+Pre-Order+Menu.jpg"
        />
        <div className="row">
          <div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/ConversationHearts.jpg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/V-Day-Tic-Tac-Toe.jpg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/You+Hold+The+Key+To+My+Heart.jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Will+You+Be+My+Valentine.jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/You+Got+My+Spidey+Senses+Tingling.jpg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Will+You+Be+My+Valentine+(Pink).jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Will+You+Be+My+Valentine+(Red).jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/V-Day-TicTacToe.jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/V-Day-TicTacToe-YouWonMyHeart.jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Whale+You+Be+My+Valentine.jpg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/V-Day+XO+XO.jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/V-Day+TicTacToe+Game.jpeg"
                }
                className={"card-img"}
              />
              <div className="special-cookie-title">Something Title</div>
              <div className="special-cookie-description">Something</div>
            </div>
          </div>
        </div>
        <a href="/order-now">
          <button>Order Now</button>
        </a>
      </div>
    </div>
  );
}
