import "./home.css";

interface HomeProps {
  isMobile: boolean;
}

export default function Home(props: HomeProps) {
  var slideIndex = 1;
  showSlides(slideIndex);

  function plusSlides(n: number) {
    showSlides((slideIndex += n));
  }

  function currentSlide(n: number) {
    showSlides((slideIndex = n));
  }

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

  return (
    <div>
      <div>
        <h1 className="home-header">Welcome</h1>
        <p className="home-body">
          Welcome to Sugar Society Sugar Cookies the newest black owned small
          business bringing you beautifully designed sugar cookies for your
          special event. Our cookies can provide that one of a kind touch to any
          birthday celebration, wedding, baby shower or corporate event. We are
          located in Rosharon, TX and are currently providing our AMAZING
          cookies and customer service to the greater Houston.
        </p>
      </div>

      <div className="slideshow-container">
        <div className="mySlides fade">
          <div className="numbertext">1 / 3</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/AmazonPeccy.jpeg"
            style={{ width: "100%" }}
          />
          <div className="text">Caption Text</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">2 / 3</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/BirthdayBlue.jpeg"
            style={{ width: "100%" }}
          />
          <div className="text">Caption Two</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">3 / 3</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/ChristmasGroup.jpeg"
            style={{ width: "100%" }}
          />
          <div className="text">Caption Three</div>
        </div>
      </div>

      <br />

      <div style={{ textAlign: "center" }}>
        <span className="dot" onClick={() => currentSlide(1)}></span>
        <span className="dot" onClick={() => currentSlide(2)}></span>
        <span className="dot" onClick={() => currentSlide(3)}></span>
      </div>
    </div>
  );
}
