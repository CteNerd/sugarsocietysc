import React, { useEffect, useState } from "react";
import "./home.css";
import Cookies from "../cookies/cookies-json/2023-valentines-cookies.json";
import SEO from "../../components/SEO";
import LoadingSpinner from "../../components/LoadingSpinner";

// Fallback cookies in case the import fails
const FALLBACK_COOKIES = [
  {
    url: "https://via.placeholder.com/800x600/e3afbc/000000?text=Sugar+Society+Cookies",
    caption: "Custom Sugar Cookies"
  },
  {
    url: "https://via.placeholder.com/800x600/f7cac9/000000?text=Special+Events",
    caption: "Perfect for special events"
  },
  {
    url: "https://via.placeholder.com/800x600/c6d7eb/000000?text=Handmade+With+Love",
    caption: "Handmade with love"
  }
];

interface HomeProps {
  isMobile: boolean;
}

export default function Home(props: HomeProps) {
  const [slideIndex, setSlideIndex] = useState(1);
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Log cookies data for debugging
  useEffect(() => {
    console.log("Cookies data:", Cookies);
    console.log("Cookies length:", Cookies?.length || 0);
  }, []);

  // Use fallback cookies if the imported cookies array is empty
  const cookiesToUse = Cookies?.length > 0 ? Cookies : FALLBACK_COOKIES;

  // Preload images
  useEffect(() => {
    if (cookiesToUse && cookiesToUse.length > 0) {
      cookiesToUse.forEach((cookie, index) => {
        if (cookie.url) {
          const img = new Image();
          img.src = cookie.url;
          img.onload = () => {
            setImagesLoaded(prev => ({...prev, [index]: true}));
            console.log(`Preloaded image ${index}`);
          };
          img.onerror = () => {
            console.warn(`Failed to preload image ${index}: ${cookie.url}`);
            // Mark as loaded even though it failed
            setImagesLoaded(prev => ({...prev, [index]: true}));
          };
        }
      });
    }
  }, [cookiesToUse]);

  // Track loaded images
  useEffect(() => {
    if (cookiesToUse.length > 0) {
      const allLoaded = Object.keys(imagesLoaded).length === cookiesToUse.length && 
        Object.values(imagesLoaded).every(loaded => loaded);
      
      console.log(`Image loading status: ${Object.keys(imagesLoaded).length}/${cookiesToUse.length} loaded`);
      setAllImagesLoaded(allLoaded);
      
      if (allLoaded) {
        console.log("All images loaded, starting slideshow");
      }
    }
  }, [imagesLoaded, cookiesToUse.length]);
  
  // Update slides whenever slideIndex changes
  useEffect(() => {
    if (allImagesLoaded) {
      console.log("Showing slide:", slideIndex);
      showSlides(slideIndex);
    }
  }, [slideIndex, allImagesLoaded]);
  
  // Setup carousel with animation end listeners
  useEffect(() => {
    if (allImagesLoaded) {
      // Ensure the first slide is shown immediately
      showSlides(1);
      setSlideIndex(1);
      
      // Set up the interval for the slideshow that advances slides automatically
      intervalRef.current = setInterval(() => {
        setSlideIndex(prevIndex => {
          // Calculate next index
          const nextIndex = prevIndex >= cookiesToUse.length ? 1 : prevIndex + 1;
          console.log("Auto-advancing to slide:", nextIndex);
          return nextIndex;
        });
      }, 10000); // Increase timer to 10 seconds for full visibility
      
      // Set up animation end listeners for all slides
      const slides = document.getElementsByClassName("mySlides") as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < slides.length; i++) {
        slides[i].addEventListener('animationend', function() {
          this.classList.remove('fade');
          console.log(`Animation ended for slide ${i+1}`);
        });
        
        slides[i].addEventListener('transitionend', function(e) {
          if (e.propertyName === 'opacity') {
            console.log(`Opacity transition ended for slide ${i+1}: ${this.style.opacity}`);
          }
        });
      }
      
      console.log("Automatic slideshow carousel timer started");
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Clean up animation listeners
        for (let i = 0; i < slides.length; i++) {
          slides[i].removeEventListener('animationend', function() {
            this.classList.remove('fade');
          });
        }
      };
    }
  }, [allImagesLoaded, cookiesToUse.length]); // Remove slideIndex from dependencies

  function showSlides(n: number) {
    // Use a more reliable and straightforward approach
    try {
      const slides = document.getElementsByClassName("mySlides") as HTMLCollectionOf<HTMLElement>;
      if (!slides || slides.length === 0) {
        console.error("No slides found in the DOM");
        return;
      }
      
      console.log(`Displaying slide ${n} of ${slides.length}`);
      
      // Adjust index if out of bounds
      let slideToShow = n;
      if (slideToShow > slides.length) slideToShow = 1;
      if (slideToShow < 1) slideToShow = slides.length;
      
      // Find currently displayed slide
      let currentlyDisplayedSlide: HTMLElement | null = null;
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].style.display === "block" && (i !== slideToShow - 1)) {
          currentlyDisplayedSlide = slides[i];
          break;
        }
      }
      
      // First handle the new slide - make it ready but invisible
      const nextSlideIndex = slideToShow - 1;
      const nextSlide = slides[nextSlideIndex];
      
      if (nextSlide) {
        // Prepare the next slide by making it visible but transparent
        nextSlide.style.display = "block";
        nextSlide.style.opacity = "0";
        nextSlide.classList.add("active-slide");
        
        // Force a reflow before starting the transition
        void nextSlide.offsetWidth;
        
        // Trigger the fade-in
        nextSlide.style.opacity = "1";
        nextSlide.classList.add("fade");
        console.log(`Prepared slide ${nextSlideIndex + 1} for display`);
      }
      
      // Now handle the current slide that needs to fade out
      if (currentlyDisplayedSlide) {
        // Trigger the fade-out
        currentlyDisplayedSlide.style.opacity = "0";
        
        // After transition completes, hide the slide
        setTimeout(() => {
          currentlyDisplayedSlide!.style.display = "none";
          currentlyDisplayedSlide!.classList.remove("active-slide", "fade");
        }, 1000); // Match transition duration with CSS
      }
      
      // Update dots
      const dots = document.getElementsByClassName("dot") as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.remove("active");
      }
      
      if (dots[nextSlideIndex]) {
        dots[nextSlideIndex].classList.add("active");
      }
    } catch (error) {
      console.error("Error in showSlides:", error);
    }
  }

  function CarouselImages() {
    if (!cookiesToUse || cookiesToUse.length === 0) {
      console.warn("No cookie data available for carousel");
      return <div className="no-cookies">No cookie images available</div>;
    }

    // If not all images are loaded yet, show loading spinner for the first one
    if (!allImagesLoaded) {
      return (
        <div className="loading-container">
          <LoadingSpinner size="60px" color="#f7cac9" />
          <p>Loading cookie images...</p>
        </div>
      );
    }

    return (
      <>
        {cookiesToUse.map((cookie, index) => (
          <div 
            className="mySlides" 
            key={`slide-${index}`}
            style={{
              display: "none", // Hide all slides initially and let showSlides function control visibility
              backgroundColor: 'white'
            }}
          >
            <div className="image-container">
              <img 
                src={cookie.url} 
                className="slide-img" 
                alt={cookie.caption || "Custom designed sugar cookie"} 
                loading={index === 0 ? "eager" : "lazy"}
                style={{ 
                  opacity: 1, 
                  backgroundColor: 'white',
                  objectFit: 'contain',
                  width: 'auto',
                  height: 'auto',
                  maxHeight: '45vh' // Leave space for the caption
                }}
                onLoad={() => {
                  setImagesLoaded(prev => ({...prev, [index]: true}));
                  console.log(`Image ${index} loaded`);
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  console.warn(`Failed to load image: ${target.src}`);
                  // Fall back to placeholder if image fails to load
                  target.src = "https://via.placeholder.com/800x600/f7cac9/000000?text=Sugar+Society+Cookies";
                  // Mark as loaded even though it's the fallback
                  setImagesLoaded(prev => ({...prev, [index]: true}));
                }}
              />
              {cookie.caption && <div className="text">{cookie.caption}</div>}
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <SEO 
        title="Sugar Society Sugar Cookies | Custom Designed Cookies in Houston"
        description="Sugar Society Sugar Cookies offers beautifully designed custom sugar cookies for birthdays, weddings, baby showers and corporate events in Houston, TX."
        pathname="/"
        imageUrl={cookiesToUse[0]?.url || ''}
        schema={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "Sugar Society Sugar Cookies",
          "image": cookiesToUse[0]?.url || '',
          "description": "Black owned small business bringing you beautifully designed sugar cookies for your special event in the greater Houston area.",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Rosharon",
            "addressRegion": "TX",
            "addressCountry": "US"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "29.3505",
            "longitude": "-95.4591"
          },
          "url": "https://sugarsocietysc.com",
          "telephone": "+12543133972",
          "priceRange": "$$",
          "servesCuisine": "Cookies, Baked Goods"
        }}
      />
      <main>
        <section className="hero-section">
          <h1 className="home-header">Welcome to Sugar Society Sugar Cookies</h1>
          <div 
            className="slideshow-container" 
            aria-label="Cookie design showcase"
            data-current-slide={slideIndex}
          >
            <CarouselImages />
            
            {/* Add navigation buttons */}
            <button className="prev" onClick={() => {
              const newIndex = slideIndex <= 1 ? cookiesToUse.length : slideIndex - 1;
              console.log("Manual navigation to previous slide:", newIndex);
              setSlideIndex(newIndex);
            }} aria-label="Previous slide">&#10094;</button>
            
            <button className="next" onClick={() => {
              const newIndex = slideIndex >= cookiesToUse.length ? 1 : slideIndex + 1;
              console.log("Manual navigation to next slide:", newIndex);
              setSlideIndex(newIndex);
            }} aria-label="Next slide">&#10095;</button>
          </div>
          
          {/* Add slide indicators outside container */}
          <div className="dots-container">
            {cookiesToUse.map((_, index) => (
              <span 
                key={`dot-${index}`}
                className={`dot ${slideIndex === index + 1 ? 'active' : ''}`} 
                onClick={() => {
                  const newIndex = index + 1;
                  setSlideIndex(newIndex);
                }}
                aria-label={`Go to slide ${index + 1}`}
              ></span>
            ))}
          </div>
        </section>
        <section className="about-section">
          <h2>Custom Sugar Cookies for Your Special Events</h2>
          <p className="home-body">
            Welcome to Sugar Society Sugar Cookies, the newest black owned small
            business bringing you beautifully designed sugar cookies for your
            special event. Our cookies can provide that one of a kind touch to any
            birthday celebration, wedding, baby shower or corporate event. We are
            located in Rosharon, TX and are currently providing our AMAZING
            cookies and customer service to the greater Houston area.
          </p>
        </section>
      </main>
    </>
  );
}
