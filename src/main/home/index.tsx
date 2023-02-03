import "./home.css";
import Cookies from "../cookies/cookies-json/2023-valentines-cookies.json";

interface HomeProps {
  isMobile: boolean;
}

export default function Home(props: HomeProps) {
  var slideIndex = 1;
  showSlides(slideIndex);

  function showSlides(n: number) {
    var i;
    var slides = document.getElementsByClassName(
      "mySlides"
    ) as HTMLCollectionOf<HTMLElement>;

    for (i = 0; i < slides.length; i++) {
      slides[i].style.display = "none";
    }
    slideIndex++;
    if (slideIndex > slides.length) {
      slideIndex = 1;
    }

    if (slides[slideIndex - 1]) {
      slides[slideIndex - 1].style.display = "block";
    }

    setTimeout(showSlides, 3500); // Change image every 3.5 seconds
  }

  function CarouselImages() {
    let content: JSX.Element[] = [];

    Cookies.forEach((cookie, index) => {
      content.push(
        <div className="mySlides fade">
          {/* <div className="numbertext">{index} / {Cookies.length}</div> */}
          <img src={cookie.url} className="slide-img" />
          <div className="text">{cookie.caption}</div>
        </div>
      );
    });

    return <div>{content}</div>;
  }

  return (
    <div>
      <div>
        <h1 className="home-header">Welcome</h1>
        <div className="slideshow-container">
          <CarouselImages />
        </div>
        <p className="home-body">
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
