import React, { useState } from "react";
import CookieModel from "../models/invoice/cookieModel";
import AddOnModel from "../models/cookie/addOnModel";
import AddOn from "./AddOn";

export interface CookieProp {
  cookie: CookieModel;
  onChange: (returnedCookie: CookieModel) => void;
}

export default function CookieComponent(props: CookieProp) {
  const [stateCookie, setStateCookie] = useState(props.cookie);

  function AddToAddOns(): void {
    let addOnToAdd = {
      id: "",
      name: "New Ones",
      type: "",
      price: 0.5,
      count: 0,
      message: "",
    };

    setStateCookie({
      ...stateCookie,
      add_ons: [...stateCookie.add_ons, addOnToAdd],
    });
  }

  function AddToColors(): void {
    setStateCookie({
      ...stateCookie,
      colors: [...stateCookie.colors, ""],
    });
  }

  function AddToInspirationalImages(): void {
    setStateCookie({
      ...stateCookie,
      inspiration_images: [...stateCookie.inspiration_images, ""],
    });
  }

  function handleChange() {
    props.onChange(stateCookie);
  }

  return (
    <div onChange={handleChange}>
      <div>
        <label>Cookie Name</label>
        <input
          onChange={(e) => {
            stateCookie.name = e.target.value;
          }}
        />
        <div>
          <div>Main Image</div>
          <img />
        </div>
        <label>Price Per Cookie</label>
        <span>$3.50</span>
        <label>Cookie Quantity</label>
        <input
          value={!isNaN(stateCookie.quantity) ? stateCookie.quantity : 0}
          onChange={(e) => {
            setStateCookie({
              ...stateCookie,
              quantity: !isNaN(stateCookie.quantity)
                ? parseFloat(e.target.value)
                : 0,
            });
          }}
        />
        <div>
          <h4>Add-Ons</h4>
          {stateCookie.add_ons.map((add_on, index) => {
            return (
              <div>
                <h5>{index + 1}. Add-On</h5>
                <AddOn
                  addOn={add_on}
                  onChange={(returnedAddOn: AddOnModel) => {
                    stateCookie.add_ons[index] = returnedAddOn;
                    setStateCookie(stateCookie);
                  }}
                />
              </div>
            );
          })}
          <button onClick={() => AddToAddOns()}>Add More</button>
        </div>
        <div>
          <h4>Colors</h4>
          {stateCookie.colors.map((color, index) => {
            return (
              <li>
                <h5>{index + 1} Color</h5>
                <input
                  value={color}
                  onChange={(e) => {
                    const stateColors = stateCookie.colors;
                    let currentColor = stateColors[index];
                    currentColor = e.target.value;
                    stateColors[index] = currentColor;
                    setStateCookie({ ...stateCookie, colors: stateColors });
                  }}
                />
              </li>
            );
          })}
          <button onClick={() => AddToColors()}>Add More</button>
        </div>
        <div>
          <h4>Inspriational Images</h4>
          <ol>
            {stateCookie.inspiration_images.map((img, index) => {
              return (
                <li>
                  <h5>{index + 1} Image</h5>
                  <input
                    value={img}
                    onChange={(e) => {
                      const stateImages = stateCookie.inspiration_images;
                      let currentImg = stateImages[index];
                      currentImg = e.target.value;
                      stateImages[index] = currentImg;
                      setStateCookie({
                        ...stateCookie,
                        inspiration_images: stateImages,
                      });
                    }}
                  />
                  <img src={img} style={{ width: "100%" }} />
                </li>
              );
            })}
          </ol>
          <button onClick={() => AddToInspirationalImages()}>Add More</button>
        </div>
      </div>
    </div>
  );
}
