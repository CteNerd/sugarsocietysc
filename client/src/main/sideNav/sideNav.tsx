import React, { useEffect, useState } from "react";
import {
  HomeOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  MailOutlined,
  LogoutOutlined,
  CaretDownOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  CarryOutOutlined,
  PlusSquareOutlined,
  BarsOutlined,
  SafetyOutlined,
  ShoppingOutlined,
  UnorderedListOutlined,
  UserOutlined,
  BookOutlined,
  StarOutlined,
  PieChartOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
  AlertOutlined,
} from "@ant-design/icons";
import "./sideNav.css";

export default function SideNav() {
  const [showEventsDropdown, setShowEventsDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showTicketDropdown, setShowTicketDropdown] = useState(false);
  const [isTixHolder, setIsTixHolder] = useState(true);
  const [canAddUsers, setCanAddUsers] = useState(false);
  const [canAddEvents, setCanAddEvents] = useState(false);
  const [canViewEventDetails, setCanViewEventDetails] = useState(false);
  const [isMemberOfOrg, setIsMemberOfOrg] = useState(false);

  function closeNav() {
    if (document.getElementById("mySidenav"))
      document.getElementById("mySidenav")!.style.width = "0";
  }

  let content = <></>;
  content = (
    <>
      <a href="/organization-registration">
        <TeamOutlined /> Add Your Team to We'll Call Tix
      </a>
      <a href="/tix-holder-registration">
        <UserOutlined /> Join We'll Call Tix Yourself
      </a>
      <a href="/login">Login</a>
    </>
  );

  return (
    <div id="mySidenav" className="sidenav">
      <div className="closebtn" onClick={closeNav}>
        &times;
      </div>
      <a href="/">
        <HomeOutlined /> Home
      </a>
      <a href="/our-story">
        <BookOutlined /> Our Story
      </a>
      <a href="/specials">
        <StarOutlined /> Specials
      </a>
      <a href="/our-cookies">
        <PieChartOutlined /> Our Cookies
      </a>
      <a href="/order-inquiry">
        <ShoppingCartOutlined /> Order Inquiry
      </a>
      <a href="/contact">
        <AlertOutlined /> Contact Us
      </a>
    </div>
  );
}
