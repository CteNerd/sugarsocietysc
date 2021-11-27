import React, { useEffect, useState } from "react";
import Cookies from "./cookies.json";
import "./cookies.css";

interface Props {
  isMobile: boolean;
}

export default function OurCookies(props: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState("");
  const [selectedCookie, setSelectedCookie] = useState("");

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
      // var dots = document.getElementsByClassName("dot");
      for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
      }
      slideIndex++;
      if (slideIndex > slides.length) {
        slideIndex = 1;
      }
      // for (i = 0; i < dots.length; i++) {
      //   dots[i].className = dots[i].className.replace(" active", "");
      // }
      slides[slideIndex - 1].style.display = "block";
      /// dots[slideIndex - 1].className += " active";
      setTimeout(showSlides, 6500); // Change image every 6.5 seconds
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

    return (
      <div className="modal-content">
        <div className="slideshow-container">
          {Cookies
            .filter((cookie) => cookie.type === selectedCookie)
            .map((cookie, index) => {
              return (
                <div className="mySlides fade" key={index}>
                  <div className="numbertext">{index + 1}</div>
                  <img src={props.isMobile ? cookie.mobileUrl : cookie.url} style={{ width: "100%" }} />
                  <div className="text">{cookie.caption}</div>
                </div>
              );
            })}
        </div>
        <br />

        {/* <div style={{ textAlign: "center" }}>
          {cookiesToDisplay
            .filter((cookie) => cookie.type === selectedCookie)
            .map(() => {
              return <span className="dot"></span>;
            })}
        </div> */}
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
    );
  }

  return (
    <div>
      <h1>Our Cookies</h1>
      <h2>Mmm Mmm Good... Say Less...</h2>
      <button
        className="accordion"
        onClick={() => {
          onAccordionSelection("christmas");
        }}
      >
        Christmas
      </button>
      <div
        className="panel"
        style={{ display: openPanel === "christmas" ? "block" : "none" }}
      >
        <div className="row">
          <div className={props.isMobile ? "col-12" : "col-4"}>
            <div
              className="card"
              key="santa"
              onClick={(e) => {
                setModalOpen(true);
                setSelectedCookie("santa");
              }}
            >
              <img
                src={"https://wellcall-app-cdk.s3.amazonaws.com/Santa+Trio.JPG"}
                className={"card-img"}
              />
              <h3>{"Santa Cookies"}</h3>
              <p>{"For those you can't wait to see on Monday"}</p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("tree");
              }}
            >
              <img
                src={"https://wellcall-app-cdk.s3.amazonaws.com/Tree+Group.JPG"}
                className={"card-img"}
              />
              <h3>{"Christmas Tree Cookies"}</h3>
              <p>{"Just need a glass of milk and a tray just for Santa"}</p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("phrase");
              }}
            >
              <img
                src={"https://wellcall-app-cdk.s3.amazonaws.com/Joy.JPG"}
                className={"card-img"}
              />
              <h3>{"Christmas Phrase Cookies"}</h3>
              <p>{"Just need a glass of milk and a tray just for Santa"}</p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("ornament");
              }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Stringed+Lights.JPG"
                }
                className={"card-img"}
              />
              <h3>{"Christmas Ornament Cookies"}</h3>
              <p>{"Just need a glass of milk and a tray just for Santa"}</p>
            </div>
          </div>
          <div className={props.isMobile ? "col-12" : "col-4"}>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("snowman");
              }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Mini+Frosty.JPG"
                }
                className={"card-img"}
              />
              <h3>{"Snowman Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("stocking");
              }}
            >
              <img
                src={"https://wellcall-app-cdk.s3.amazonaws.com/Stocking.JPG"}
                className={"card-img"}
              />
              <h3>{"Christmas Stocking Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("reindeer");
              }}
            >
              <img
                src={"https://wellcall-app-cdk.s3.amazonaws.com/Rudolph2.JPG"}
                className={"card-img"}
              />
              <h3>{"Reindeer Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("hollyberry");
              }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Holly+Berry1.JPG"
                }
                className={"card-img"}
              />
              <h3>{"Holly Berry Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
          </div>
          <div className={props.isMobile ? "col-12" : "col-4"}>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("gingerbread");
              }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Ginger+Family.JPG"
                }
                className={"card-img"}
              />
              <h3>{"Gingerbread Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("candycane");
              }}
            >
              <img
                src={
                  "https://wellcall-app-cdk.s3.amazonaws.com/Candy+Cane+Lane.JPG"
                }
                className={"card-img"}
              />
              <h3>{"Candy Cane Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
            <div
              className="card"
              onClick={() => {
                setModalOpen(true);
                setSelectedCookie("star");
              }}
            >
              <img
                src={"https://wellcall-app-cdk.s3.amazonaws.com/Star+Trio.JPG"}
                className={"card-img"}
              />
              <h3>{"Christmas Star Cookies"}</h3>
              <p>
                {
                  "Making life a little sweeter for that special someone in your life"
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        className="accordion"
        onClick={() => {
          onAccordionSelection("birthday");
        }}
      >
        Birthday
      </button>
      <div
        className="panel"
        style={{ display: openPanel === "birthday" ? "block" : "none" }}
      >
        <p>Coming Soon...</p>
      </div>

      <button
        className="accordion"
        onClick={() => {
          onAccordionSelection("work");
        }}
      >
        Work
      </button>
      <div
        className="panel"
        style={{ display: openPanel === "work" ? "block" : "none" }}
      >
        <p>Coming Soon...</p>
      </div>
      <div id="myModal" className={modalOpen ? "modal-opened" : "modal-closed"}>
        <ModalContent />
      </div>
    </div>
  );
}
