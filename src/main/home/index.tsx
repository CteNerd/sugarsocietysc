import { LoadingOutlined } from "@ant-design/icons";
import React from "react";

interface HomeProps {
  isMobile: boolean;
}

export default function Home(props: HomeProps) {
  return (
    <div>
      <div>
        <h1>Welcome</h1>
        <p>
          Welcome to Sugar Society Sugar Cookies the newest black owned small
          business bringing you beautifully designed sugar cookies for your
          special event. Our cookies can provide that one of a kind touch to any
          birthday celebration, wedding, baby shower or corporate event. We’re
          located in Rosharon, TX and providing our amazing cookies and customer
          service to the greater Houston area.
        </p>
        <div>
          <h2>Got Questions? Contact Us</h2>
          <p>
            We can be reached anytime via the contact form which will email us
            immediately.
          </p>
        </div>
        <a href="/contact">
          <button>Contact Form</button>
        </a>
      </div>
    </div>
  );
}
