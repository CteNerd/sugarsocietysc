import React from "react";
// import {
//   HomeOutlined,
//   InfoCircleOutlined,
//   TeamOutlined,
//   MailOutlined,
//   LogoutOutlined,
//   CaretDownOutlined,
//   UserAddOutlined,
//   UsergroupAddOutlined,
//   CalendarOutlined,
//   ScheduleOutlined,
//   CarryOutOutlined,
//   PlusSquareOutlined,
//   BarsOutlined,
//   SafetyOutlined,
//   ShoppingOutlined,
//   UnorderedListOutlined,
//   UserOutlined,
//   BookOutlined,
//   StarOutlined,
//   PieChartOutlined,
//   ProfileOutlined,
//   ShoppingCartOutlined,
//   AlertOutlined,
// } from "@ant-design/icons";
import "./sideNav.css";

export default function SideNav() {
  function closeNav() {
    if (document.getElementById("mySidenav"))
      document.getElementById("mySidenav")!.style.width = "0";
  }

  return (
    <div id="mySidenav" className="sidenav">
      <div className="closebtn" onClick={closeNav}>
        &times;
      </div>
      <a href="/" onClick={closeNav}>
        {/* <HomeOutlined />  */}
        Home
      </a>
      <a href="/our-story" onClick={closeNav}>
        {/* <BookOutlined />  */}
        Our Story
      </a>
      <a href="/specials" onClick={closeNav}>
        {/* <StarOutlined />  */}
        Specials
      </a>
      <a href="/our-cookies" onClick={closeNav}>
        {/* <PieChartOutlined />  */}
        Our Cookies
      </a>
      {/* <a href="/pricing">
        <ShoppingCartOutlined /> Pricing
      </a> */}
      <a href="/order-now" onClick={closeNav}>
        {/* <AlertOutlined />  */}
        Order Now
      </a>
    </div>
  );
}
