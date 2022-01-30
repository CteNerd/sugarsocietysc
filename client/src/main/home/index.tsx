import "./home.css";
import Cookies from "../cookies/valentines-cookies.json"

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
    let content:JSX.Element[] = []

    Cookies.forEach((cookie, index) => {
      content.push(
        <div className="mySlides fade">
          <div className="numbertext">{index} / {Cookies.length}</div>
          <img
            src={cookie.url}
            className="slide-img"
          />
          <div className="text">{cookie.caption}</div>
        </div>
      )
    });

    return (
      <div>
        {content}
      </div>
    )
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
        {/* <div className="mySlides fade">
          <div className="numbertext">1 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/ConversationHearts.jpg"
            className="slide-img"
          />
          <div className="text">Conversation Hearts</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">2 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/V-Day-Tic-Tac-Toe.jpg"
            className="slide-img"
          />
          <div className="text">Tic Tac Toe</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">3 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/You+Hold+The+Key+To+My+Heart.jpeg"
            className="slide-img"
          />
          <div className="text">You Have the Key to My Heart</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">4 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/Will+You+Be+My+Valentine.jpeg"
            className="slide-img"
          />
          <div className="text">Will You Be My Valentine?</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">5 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/You+Got+My+Spidey+Senses+Tingling.jpg"
            className="slide-img"
          />
          <div className="text">Spiderman</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">6 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/Will+You+Be+My+Valentine+(Pink).jpeg"
            className="slide-img"
          />
          <div className="text">Will You Be My Valentine?</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">7 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/Will+You+Be+My+Valentine+(Red).jpeg"
            className="slide-img"
          />
          <div className="text">Will You Be My Valentine?</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">8 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/V-Day-TicTacToe.jpeg"
            className="slide-img"
          />
          <div className="text">Tic Tac Toe</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">9 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/Whale+You+Be+My+Valentine.jpg"
            className="slide-img"
          />
          <div className="text">Whale You Be My Valentine?</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">10 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/V-Day+XO+XO.jpeg"
            className="slide-img"
          />
          <div className="text">XO XO</div>
        </div>

        <div className="mySlides fade">
          <div className="numbertext">11 / 11</div>
          <img
            src="https://wellcall-app-cdk.s3.amazonaws.com/V-Day+TicTacToe+Game.jpeg"
            className="slide-img"
          />
          <div className="text">Tic Tac Toe</div>
        </div> */}

        <CarouselImages />

      </div>
    </div>
  );
}
