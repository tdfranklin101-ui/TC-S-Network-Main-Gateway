import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

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
      <header className="hero bg-gradient-to-r from-[#0057B8] to-[#00A896] text-white py-20 text-center relative">
        <div className="container mx-auto px-4">
          <img src="/branding_logo.png" alt="The Current-See Logo" className="logo w-24 h-24 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome to The Current-See</h1>
          <p className="text-xl md:text-2xl mb-8">A new global economy backed by the Sun. One Solar. One Earth. Daily.</p>
          <button 
            onClick={() => scrollToSection("demo")}
            className="cta-button bg-[#FFD700] text-[#212529] hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300"
          >
            Enter the Demo
          </button>
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
          
          <div className="text-center">
            <a 
              href="https://replit.com/@yourprojectpath" 
              target="_blank" 
              className="cta-button bg-[#0057B8] text-white hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 inline-block"
            >
              Run the Wallet Demo
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

      {/* Contact/Footer Section */}
      <footer id="contact" className="py-10 bg-[#212529] text-white text-center">
        <div className="container mx-auto px-4">
          <p className="mb-2">🌐 Contact us at <a href="mailto:hello@thecurrentsee.org" className="text-[#FFD700] hover:underline">hello@thecurrentsee.org</a></p>
          <p>&copy; 2025 The Current-See PBC, Inc. | All rights reserved</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
