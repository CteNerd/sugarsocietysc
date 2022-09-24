import React, { useEffect, useState } from "react";
import axios from "axios";
import { SubmitInvoiceModel } from "../../models/invoice/submitInvoiceModel";
import { NotificationManager } from "react-notifications";
import moment from "moment";
import CookieComponent from "../../components/Cookie";
import CookieModel from "../../models/invoice/cookieModel";

let initialInvoice: SubmitInvoiceModel = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  taxPercentage: 0,
  cookies: [
    {
      name: "",
      id: "",
      pricePerEach: 3.5,
      add_ons: [
        {
          id: "",
          name: "",
          type: "",
          price: 0.5,
          count: 0,
          message: "",
        },
      ],
      colors: [""],
      inspiration_images: [""],
      quantity: 1,
    },
  ],
  pickupDate: moment().add(1, "days").format(),
  dateCreated: "",
  invoiceNumber: "",
};

export default function CreateInvoice() {
  const [invoice, setInvoice] = useState(initialInvoice);

  function submitInvoice() {
    axios
      .post(`https://sugarsocietysc-api.azurewebsites.net/api/invoice`, invoice)
      .then((res) => {
        NotificationManager.success(
          "Successfully submitted invoice.",
          "Invoice Sent."
        );
      })
      .catch(() => {
        NotificationManager.error(
          "Failed to submit invoice.",
          "Error",
          5000,
          () => {
            alert("callback");
          }
        );
      });
  }

  function AddNewCookie() {
    let cookieToAdd: CookieModel = {
      name: "",
      id: "",
      pricePerEach: 3.5,
      add_ons: [],
      colors: [""],
      inspiration_images: [""],
      quantity: 1,
    };

    setInvoice({ ...invoice, cookies: [...invoice.cookies, cookieToAdd] });
  }

  return (
    <div>
      <section>
        <div>
          <h3>Contact Information</h3>
          <div>
            <label>First Name</label>
            <input
              onChange={(e) =>
                setInvoice({ ...invoice, firstName: e.target.value })
              }
            />
            <label>Last Name</label>
            <input
              onChange={(e) =>
                setInvoice({ ...invoice, lastName: e.target.value })
              }
            />
            <label>Email</label>
            <input
              onChange={(e) =>
                setInvoice({ ...invoice, email: e.target.value })
              }
            />
            <label>Phone</label>
            <input
              onChange={(e) =>
                setInvoice({ ...invoice, phone: e.target.value })
              }
            />
          </div>
        </div>
      </section>
      <section>
        <div>
          <h3>Delivery Information</h3>
          <div>
            <label>Address 1</label>
            <input />
            <label>Address 2</label>
            <input />
            <label>City</label>
            <input />
            <label>State</label>
            <input />
            <label>Zip Code</label>
            <input />
          </div>
        </div>
      </section>
      <section>
        {invoice.cookies.map((cookie, index) => {
          return (
            <div>
              <h4>{index + 1}. Cookie</h4>
              <CookieComponent
                cookie={cookie}
                onChange={(returnedCookie) => {
                  invoice.cookies[index] = returnedCookie;
                  setInvoice(invoice);
                }}
              />
            </div>
          );
        })}
        <button onClick={() => AddNewCookie()}>Add Cookie</button>
      </section>
      <button onClick={() => submitInvoice()}>Submit Invoice</button>
    </div>
  );
}
