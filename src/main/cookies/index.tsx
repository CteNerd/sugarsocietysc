import React, { useEffect, useState } from "react";
import Cookies from "./cookies-json/2022-christmas-cookies.json";
import "./cookies.css";
import { Carousel } from "antd";
import { clearTimeout } from "timers";

interface Props {
  isMobile: boolean;
}

export default function OurCookies(props: Props) {
  var slideIndex = 1;
  const [modalOpen, setModalOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState("");
  const [selectedCookie, setSelectedCookie] = useState("");
  const [modalCookie, setModalCookie] = useState<any>();

  useEffect(() => {
    showSlides(1);
  }, []);

  // Next/previous controls
  function plusSlides(n: number) {
    showSlides((slideIndex += n));
  }

  function showSlides(n: number) {
    var i;
    var slides = Array.from(
      document.getElementsByClassName(
        "mySlides"
      ) as HTMLCollectionOf<HTMLElement>
    );

    if (n) {
      if (n > slides.length) {
        slideIndex = 1;
      }
      if (n < 1) {
        slideIndex = slides.length;
      }
    }

    for (i = 0; i < slides.length; i++) {
      slides[i].style.display = "none";
    }

    if (slides.length > 0) {
      slides[slideIndex - 1].style.display = "block";
    }
  }

  function onAccordionSelection(key: string) {
    if (key === openPanel) {
      setOpenPanel("");
      return;
    }

    setOpenPanel(key);
  }

  function ModalContent() {
    let cookiesToShow = Cookies.filter(
      (cookie) => cookie.type === selectedCookie
    );

    return (
      <div className="modal-content">
        <div className="slideshow-container">
          <div>
            <div className="numbertext">
              {modalCookie !== undefined ? modalCookie.caption : ""}
            </div>
            <img
              src={modalCookie !== undefined ? modalCookie.mobileUrl : ""}
              style={{ width: "100%" }}
            />
            <div className="text">
              {modalCookie !== undefined ? modalCookie.size : ""}
            </div>
          </div>
        </div>
        <br />
        <div>
          {cookiesToShow.map((cookie) => {
            return (
              <img
                key={cookie.mobileUrl}
                onClick={() => {
                  setModalCookie(cookie);
                }}
                className="cookie-thumbnail"
                src={cookie.mobileUrl}
              />
            );
          })}
        </div>
        <div>
          <button
            className="modal-btn"
            onClick={() => {
              setModalOpen(false);
              setModalCookie(undefined);
            }}
          >
            Close
          </button>
          <a href="/order-inquiry">
            <button className="modal-btn" onClick={() => setModalOpen(false)}>
              Purchase
            </button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Our Cookies</h1>
      <div className="panel">
        <div className="row">
          <div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/AmazonPeccy.jpeg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/BirthdayBlue.jpeg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/BirthdayColorful.JPG"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/ChristmasGroup.jpeg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/ConversationHearts.jpg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/GreekLife-AKA.jpeg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/GreekLife-Delta.jpeg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/HawaiianCulture.jpeg"
                }
                className={"card-img"}
              />
            </div>
            <div
              className={"card-img-container"}
              style={{ width: props.isMobile ? "50%" : "33%" }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/V-Day-Tic-Tac-Toe.jpg"
                }
                className={"card-img"}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ingredients-container">
        <h4 className="ingredients-header">Ingredients</h4>
        <div className="ingredients-body">
          Our cookie dough is made from scratch for each order! We understand
          many people have food allergies or sensitivities so below you will
          find the specific ingredients included in our yummy sugar cookies.
          Please let us know if you have further questions.
        </div>
        <div className="ingredients-body">
          Ingredients: All Purpose Flour (Bleached) , Granulated Sugar, Powdered
          Sugar, Salted Butter, Egg, Vanilla Extract, Baking Powder, Salt,
          Meringue Powder, Water, Corn Syrup, Glycerin, Yellow5, Blue1, Red3,
          Yellow6, Red40, Agar Gum, Potassium Sorbate, Citric Acid, Sodium
          Citrate
        </div>
      </div>
      <div className="allergens-container">
        <h4 className="allergens-header">Allergens</h4>
        <div className="allergens-body">Allergen: Egg and Wheat</div>
      </div>
      <div id="myModal" className={modalOpen ? "modal-opened" : "modal-closed"}>
        <ModalContent />
      </div>
    </div>
  );
}
