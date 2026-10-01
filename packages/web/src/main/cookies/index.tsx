import React from "react";
import { Helmet } from "react-helmet";
import "./cookies.css";

interface Props {
  isMobile: boolean;
}

export default function OurCookies(props: Props) {
  return (
    <>
      <Helmet>
        <title>Our Cookies | Sugar Society Sugar Cookies</title>
        <meta
          name="description"
          content="Browse our beautiful custom-designed sugar cookies for special events. Sugar Society offers unique cookie designs for birthdays, weddings, and more in Houston, TX."
        />
      </Helmet>
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
                  alt="Amazon Peccy cookie design"
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
                  alt="Blue birthday cookie design"
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
                  alt="Colorful birthday cookie design"
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
                  alt="Christmas cookie assortment"
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
                  alt="Conversation heart cookies"
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
                  alt="Alpha Kappa Alpha Greek life cookie design"
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
                  alt="Delta Sigma Theta Greek life cookie design"
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
                  alt="Hawaiian culture cookie design"
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
                  alt="Valentine tic-tac-toe cookie design"
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
            Ingredients: All Purpose Flour (Bleached) , Granulated Sugar,
            Powdered Sugar, Salted Butter, Egg, Vanilla Extract, Baking Powder,
            Salt, Meringue Powder, Water, Corn Syrup, Glycerin, Yellow5, Blue1,
            Red3, Yellow6, Red40, Agar Gum, Potassium Sorbate, Citric Acid,
            Sodium Citrate
          </div>
        </div>
        <div className="allergens-container">
          <h4 className="allergens-header">Allergens</h4>
          <div className="allergens-body">Allergen: Egg and Wheat</div>
        </div>
      </div>
    </>
  );
}
