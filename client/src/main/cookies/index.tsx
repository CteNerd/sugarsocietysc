import React, { useState } from "react";
import "./cookies.css";

interface Props {
  isMobile: boolean;
}

export default function OurCookies(props: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  var slideIndex = 0;

  if (document.getElementsByClassName("mySlides")) {
    showSlides();
  }

  function showSlides() {
    var i;
    var slides = Array.from(
      document.getElementsByClassName(
        "mySlides"
      ) as HTMLCollectionOf<HTMLElement>
    );

    if (slides.length > 0) {
      var dots = document.getElementsByClassName("dot");
      for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
      }
      slideIndex++;
      if (slideIndex > slides.length) {
        slideIndex = 1;
      }
      for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
      }
      slides[slideIndex - 1].style.display = "block";
      dots[slideIndex - 1].className += " active";
      setTimeout(showSlides, 6500); // Change image every 2 seconds
    }
  }

  return (
    <div>
      <h1>Our Cookies</h1>
      <h2>Mmm Mmm Good... Say Less...</h2>
      <div className="row">
        <div className={props.isMobile ? "col-12" : "col-4"}>
          <div className="card" onClick={() => setModalOpen(true)}>
            <img
              src={
                "https://wellcall-app-cdk.s3.amazonaws.com/Tech+Logo+No+Padding.png"
              }
              className={"card-img"}
            />
            <h3>{"Work Cookies"}</h3>
            <p>{"For those you can't wait to see on Monday"}</p>
          </div>
          <div className="card" onClick={() => setModalOpen(true)}>
            <img
              src={
                "https://wellcall-app-cdk.s3.amazonaws.com/Sugar-Cookies-8.jpg"
              }
              className={"card-img"}
            />
            <h3>{"Christmas Cookies"}</h3>
            <p>{"Just need a glass of milk and a tray just for Santa"}</p>
          </div>
        </div>
        <div className={props.isMobile ? "col-12" : "col-4"}>
          <div className="card" onClick={() => setModalOpen(true)}>
            <img
              src={
                "https://wellcall-app-cdk.s3.amazonaws.com/Tech+Logo+No+Padding.png"
              }
              className={"card-img"}
            />
            <h3>{"Birthday Cookies"}</h3>
            <p>
              {
                "Making life a little sweeter for that special someone in your life"
              }
            </p>
          </div>
        </div>
      </div>
      <div id="myModal" className={modalOpen ? "modal-opened" : "modal-closed"}>
        <div className="modal-content">
          <div className="slideshow-container">
            <div className="mySlides fade">
              <div className="numbertext">1 / 3</div>
              <img
                src="https://wellcall-app-cdk.s3.amazonaws.com/2677637c-e921-4999-933e-b5d1270ab579.jpg"
                style={{ width: "100%" }}
              />
              <div className="text">Caption Text</div>
            </div>

            <div className="mySlides fade">
              <div className="numbertext">2 / 3</div>
              <img
                src="https://wellcall-app-cdk.s3.amazonaws.com/2677637c-e921-4999-933e-b5d1270ab579.jpg"
                style={{ width: "100%" }}
              />
              <div className="text">Caption Two</div>
            </div>

            <div className="mySlides fade">
              <div className="numbertext">3 / 3</div>
              <img
                src="https://wellcall-app-cdk.s3.amazonaws.com/371a31ef-1692-4911-a9c2-6d38f822c8a9.jpg"
                style={{ width: "100%" }}
              />
              <div className="text">Caption Three</div>
            </div>
          </div>
          <br />

          <div style={{ textAlign: "center" }}>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
          <div>
            <button className="modal-btn" onClick={() => setModalOpen(false)}>
              Close
            </button>
            <a href="/order-inquiry">
              <button className="modal-btn" onClick={() => setModalOpen(false)}>
                Purchase
              </button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
