import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import Footer from "../components/Footer";

const Home = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offsetTop = element.offsetTop;
      window.scrollTo({
        top: offsetTop - 20,
        behavior: "smooth",
      });
    }
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    // Here you would typically send this to your backend
    toast({
      title: "Success!",
      description: "You've been subscribed to our newsletter.",
    });
    
    setEmail("");
  };

  return (
    <div className="font-body bg-white text-[#212529]">
      {/* Hero Section */}
      <header className="hero text-white py-20 text-center relative" style={{ 
        backgroundImage: 'url(/solar_background.png)', 
        backgroundSize: 'cover', 
        backgroundPosition: 'center' 
      }}>
        <div className="container mx-auto px-4">
          <img src="/branding_logo.png" alt="The Current-See Logo" className="logo w-24 h-24 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)' }}>Welcome to The Current-See</h1>
          <p className="text-xl md:text-2xl mb-8" style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' }}>A new global economy backed by the Sun. One Solar. One Earth. Daily.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => scrollToSection("demo")}
              className="cta-button bg-[#FFD700] text-[#212529] hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300"
            >
              Learn More
            </button>
            <a 
              href="https://replit.com/@tdfranklin101/SolarSpender" 
              target="_blank" 
              className="cta-button bg-white text-[#0057B8] hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300"
            >
              Try the Demo
            </a>
            <a 
              href="/signup.html" 
              className="cta-button bg-[#28a745] text-white hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300"
            >
              Join Waitlist
            </a>
          </div>
        </div>
      </header>

      {/* Demo Section */}
      <section id="demo" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8 text-[#0057B8]">Prototype Overview</h2>
          <p className="text-lg text-center max-w-3xl mx-auto mb-8">
            This live demo simulates our situationally aware wallet and global solar income generator.
          </p>
          
          <ul className="max-w-md mx-auto mb-10 space-y-3">
            <li className="flex items-center">
              <span className="mr-2">🌞</span>
              <span>1 Solar = 17.7M kWh = $136,000</span>
            </li>
            <li className="flex items-center">
              <span className="mr-2">💰</span>
              <span>1,000 registered users receive full daily distribution</span>
            </li>
            <li className="flex items-center">
              <span className="mr-2">📊</span>
              <span>Strategic reserves fund infrastructure</span>
            </li>
          </ul>
          
          <div className="text-center mx-auto">
            <a 
              href="https://replit.com/@tdfranklin101/SolarSpender" 
              target="_blank" 
              className="cta-button bg-[#0057B8] text-white hover:bg-opacity-90 font-bold py-4 px-8 rounded-lg shadow-lg transition duration-300 text-center text-lg"
            >
              Try Solar Spender Prototype
            </a>
          </div>
        </div>
      </section>

      {/* Merchandise Section */}
      <section id="merch" className="py-16 bg-[#F8F9FA]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8 text-[#0057B8]">Support the Solar Movement</h2>
          
          <div className="merch-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
            <div className="item bg-white p-6 rounded-lg shadow-md text-center">
              <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-lg mb-4">
                <img src="/solar_spinner.png" alt="Solar Spinner" className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-lg font-medium">Solar Spinner Bulb</p>
            </div>
            
            <div className="item bg-white p-6 rounded-lg shadow-md text-center">
              <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-lg mb-4">
                <img src="/solar_coin.png" alt="Solar Coin" className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-lg font-medium">Energy Coin</p>
            </div>
            
            <div className="item bg-white p-6 rounded-lg shadow-md text-center">
              <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-lg mb-4">
                <img src="/solar_tshirt.png" alt="Solar Shirt" className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-lg font-medium">1 Solar = $136K Tee</p>
            </div>
          </div>
          
          <p className="centered text-center">
            <button 
              onClick={() => scrollToSection("contact")}
              className="cta-button bg-[#0057B8] text-white hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300"
            >
              Contribute or Order
            </button>
          </p>
        </div>
      </section>

      {/* Resources Section */}
      <section id="resources" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8 text-[#0057B8]">Additional Resources</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-[#F8F9FA] p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-3 text-[#0057B8]">Founder's Note</h3>
              <p className="mb-4">Read a personal message from Terry D. Franklin about the vision behind The Current-See.</p>
              <a 
                href="/founder_note.html" 
                className="inline-block bg-[#0057B8] text-white hover:bg-opacity-90 font-medium py-2 px-4 rounded transition duration-300"
              >
                Read Note
              </a>
            </div>

            <div className="bg-[#F8F9FA] p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-3 text-[#0057B8]">White Papers</h3>
              <p className="mb-4">Explore our technical research and economic models for the solar-backed economy.</p>
              <a 
                href="/whitepapers.html" 
                className="inline-block bg-[#0057B8] text-white hover:bg-opacity-90 font-medium py-2 px-4 rounded transition duration-300"
              >
                View Papers
              </a>
            </div>

            <div className="bg-[#F8F9FA] p-6 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-3 text-[#0057B8]">Join Our Waitlist</h3>
              <p className="mb-4">Be among the first to experience the solar economy and receive priority access when we launch.</p>
              <a 
                href="/signup.html" 
                className="inline-block bg-[#28a745] text-white hover:bg-opacity-90 font-medium py-2 px-4 rounded transition duration-300"
              >
                Join Waitlist
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-10 bg-[#212529] text-white text-center">
        <div className="container mx-auto px-4">
          <p className="mb-2">🌐 Contact us at <a href="mailto:hello@thecurrentsee.org" className="text-[#FFD700] hover:underline">hello@thecurrentsee.org</a></p>
        </div>
      </section>
      
      {/* Footer with all links */}
      <Footer />
    </div>
  );
};

export default Home;
