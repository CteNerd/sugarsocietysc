import { LoadingOutlined } from "@ant-design/icons";
import React from "react";
import './home.css'

interface HomeProps {
  isMobile: boolean;
}

export default function Home(props: HomeProps) {
  return (
    <div>
      <div>
        <h1 className='home-header'>Welcome</h1>
        <p className='home-body'>
          Welcome to Sugar Society Sugar Cookies the newest black owned small
          business bringing you beautifully designed sugar cookies for your
          special event. Our cookies can provide that one of a kind touch to any
          birthday celebration, wedding, baby shower or corporate event. We are
          located in Rosharon, TX and are currently providing our AMAZING
          cookies and customer service to the greater Houston.
        </p>
      </div>
    </div>
  );
}
