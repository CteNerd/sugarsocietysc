import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Services from './components/Services';
import News from './pages/News';
import Contact from './pages/Contact';
import Hero from './components/Hero';
import Footer from './components/Footer';
import { checkHealth } from './api';

const App: React.FC = () => {

    useEffect(() => {
        console.log('Fetching health status...');
        const fetchHealthStatus = async () => {
            try {
                const status = await checkHealth();
                // setHealthStatus(status);
            } catch (error) {
                // setError('Failed to load health status');
                console.error('Error fetching health status:', error);
            }
        };

        fetchHealthStatus();
    }, []);
    
    return (
      <div className="App">
        <main>
          <Hero />
          <Services />
          <About />
          <Footer />
        </main>
      </div>
    );
  };
  
// const App: React.FC = () => {
//     return (
//         <Router>
//             <Routes>
//                 <Route path="/" element={<Home />} />
//                 <Route path="/about" element={<About />} />
//                 <Route path="/services" element={<Services />} />
//                 <Route path="/news" element={<News />} />
//                 <Route path="/contact" element={<Contact />} />
//             </Routes>
//         </Router>
//     );
// };

export default App;