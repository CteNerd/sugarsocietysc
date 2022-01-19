import React, { useEffect } from "react";
import sgMail from "@sendgrid/mail";
import "./pricing.css";

export default function Pricing() {
  return (
    <div>
      <h1 className="pricing-header">Pricing</h1>
      <div>
        <p>TBD</p>
      </div>
      <div className="pricing-table-container">
        <div className="pricing-table">
          <table>
            <tr className="pricing-table-header tooltip">
              <td>
                Standard Cookie Order (2 Dozen)
                <span className="tooltiptext">$2.29/cookie</span>
              </td>
              <td className="pricing-table-price">$55.00</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>Additional Cookies</td>
              <td className="pricing-table-price">$2.29</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Un-Iced Standard Cookie Order
                <span className="tooltiptext">24 cookies, no icing</span>
              </td>
              <td className="pricing-table-price">$36.00</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Specialty Cookie Order (1 Dozen)
                <span className="tooltiptext">$3/cookie</span>
              </td>
              <td className="pricing-table-price">$36.00</td>
            </tr>
          </table>
        </div>
        <div className="pricing-table">
          <table>
            <tr className="pricing-table-header tooltip">
              <td>Cookie Design Extras</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Writing on Cookie
                <span className="tooltiptext">per cookie</span>
              </td>
              <td className="pricing-table-price">$0.50</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Cookie Design Difficulty
                <span className="tooltiptext">
                  based on level of difficulty
                </span>
              </td>
              <td className="pricing-table-price">$0.25 - $1.00</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Cookie Stencil
                <span className="tooltiptext">per cookie</span>
              </td>
              <td className="pricing-table-price">$0.50</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Custom Cookie Stencil
                <span className="tooltiptext">per stencil added to order</span>
              </td>
              <td className="pricing-table-price">$2.00</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Additional Colors
                <span className="tooltiptext">per color added to order</span>
              </td>
              <td className="pricing-table-price">$0.50</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Character Cookie
                <span className="tooltiptext">addtional per cookie</span>
              </td>
              <td className="pricing-table-price">$1.00</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Replicated Cookie
                <span className="tooltiptext">additional per cookie</span>
              </td>
              <td className="pricing-table-price">$2.71</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Additional Cookie Cutter Design
                <span className="tooltiptext">per cookie cutter design</span>
              </td>
              <td className="pricing-table-price">$1.00</td>
            </tr>
          </table>
        </div>
        <div className="pricing-table">
          <table>
            <tr className="pricing-table-header tooltip">
              <td>Packaging</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>Box w/ Zig Zag Paper</td>
              <td className="pricing-table-price">$1.00</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>Bakery Box w/ Zig Zag Paper</td>
              <td className="pricing-table-price">$1.50</td>
            </tr>
          </table>
        </div>
        <div className="pricing-table">
          <table>
            <tr className="pricing-table-header tooltip">
              <td>Shipping</td>
              <td className="pricing-table-price">TBD</td>
            </tr>
          </table>
        </div>
        <div className="pricing-table">
          <table>
            <tr className="pricing-table-header tooltip">
              <td>Other</td>
            </tr>
            <tr className="pricing-table-item tooltip">
              <td>
                Rush Order
                <span className="tooltiptext">36 Hour Notice or less</span>
              </td>
              <td className="pricing-table-price">$15.00</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  );
}
