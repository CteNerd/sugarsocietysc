import React from 'react';

export default function CreateInvoice() {

    return (
    <div>
        <div>
            <h3>Contact Information</h3>
            <div>
                <label>
                    First Name
                </label>
                <input />
                <label>
                    Last Name
                </label>
                <input />
                <label>
                    Email
                </label>
                <input />
                <label>
                    Phone
                </label>
                <input />
            </div>
        </div>
        <div>
            <h3>Delivery Information</h3>
            <div>
                <label>
                    Address 1
                </label>
                <input />
                <label>
                    Address 2
                </label>
                <input />
                <label>
                    City
                </label>
                <input />
                <label>
                    State
                </label>
                <input />
                <label>
                    Zip Code
                </label>
                <input />
            </div>
        </div>
        <div>
            <h3>Cookie Selection</h3>
            <div>
                <label>Cookie Name</label>
                <div>
                    <div>Main Image</div>
                    <img />
                </div>
                <label>Price Per Cookie</label>
                <span>$3.50</span>
                <label>Cookie Quantity</label>
                <input />
                <div>
                    <h4>Add-Ons</h4>
                    <label>Type</label>
                    <select>
                        <option>Select Add-On</option>
                        <option>Writing</option>
                        <option>Spray Paint</option>
                    </select>
                    <label>Custom Message</label>
                    <input />
                    <label>Price Per Add-On</label>
                    <span>$0.50</span>
                    <label>Add-On Quantity</label>
                    <select>
                        <option>Select Count</option>
                        <option>1</option>
                        <option>2</option>
                        <option>3</option>
                    </select>
                </div>
                <div>
                    <h4>Colors</h4>
                    <label>Primary Color of Cookie</label>
                    <input />
                    <label>Secondary Color of Cookie</label>
                    <input />
                    <label>Additional Colors</label>
                    <input />
                </div>
                <div>
                    <h4>Inspriational Images</h4>
                    <ol>
                        <li>
                            <input />
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    </div>
    )
}