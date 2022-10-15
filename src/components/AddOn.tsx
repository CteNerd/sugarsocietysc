import React, { useState } from "react";
import AddOnModel from "../models/cookie/addOnModel";

export interface AddOnProp {
  addOn: AddOnModel;
  onChange: (returnedAddOn: AddOnModel) => void;
}

export default function AddOn(props: AddOnProp) {
  const [stateAddOn, setStateAddOn] = useState(props.addOn);

  function handleChange() {
    props.onChange(stateAddOn);
  }

  return (
    <div onBlur={handleChange}>
      <div>
        <label>Add On Name</label>
        <input
          value={stateAddOn.name}
          onChange={(e) => {
            setStateAddOn({ ...stateAddOn, name: e.target.value });
          }}
        />
      </div>
      <div>
        <label>Add On Type</label>
        <input
          value={stateAddOn.type}
          onChange={(e) =>
            setStateAddOn({ ...stateAddOn, type: e.target.value })
          }
        />
      </div>
      <div>
        <label>Add On Message</label>
        <input
          value={stateAddOn.message}
          onChange={(e) =>
            setStateAddOn({ ...stateAddOn, message: e.target.value })
          }
        />
      </div>
      <div>
        <label>Add On Price</label>
        <input
          value={stateAddOn.price}
          onChange={(e) => {
            console.log(e.target.value);
            setStateAddOn({
              ...stateAddOn,
              price:
                e.target.value !== undefined ? parseFloat(e.target.value) : 0,
            });
          }}
          onBlur={(e) => {
            console.log(e.target.value);
            setStateAddOn({
              ...stateAddOn,
              price:
                e.target.value !== undefined ? parseFloat(e.target.value) : 0,
            });
          }}
        />
      </div>
      <div>
        <label>Add On Count</label>
        <input
          value={stateAddOn.count}
          onChange={(e) => {
            setStateAddOn({
              ...stateAddOn,
              count:
                e.target.value !== undefined ? parseFloat(e.target.value) : 0,
            });
          }}
          onBlur={(e) =>
            setStateAddOn({
              ...stateAddOn,
              count:
                e.target.value !== undefined ? parseFloat(e.target.value) : 0,
            })
          }
        />
      </div>
    </div>
  );
}
