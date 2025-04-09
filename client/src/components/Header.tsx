import { useState, useEffect } from "react";
import { Link } from "wouter";
import logo from "../assets/logo.svg";
import { Menu } from "lucide-react";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleResources = () => {
    setResourcesOpen(!resourcesOpen);
  };

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    setResourcesOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      const offsetTop = element.offsetTop - 80; // Account for fixed header
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    }
  };

  const openExternalPage = (url: string) => {
    setMobileMenuOpen(false);
    setResourcesOpen(false);
    window.open(url, '_blank');
  };

  return (
    <header className={`sticky top-0 z-50 bg-white ${scrolled ? 'shadow-md' : ''}`}>
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <img src={logo} alt="The Current-See Logo" className="h-10 w-10 rounded-full" />
          <span className="ml-2 text-xl font-bold font-heading text-[#0057B8]">Current-See</span>
        </Link>
        
        {/* Desktop navigation */}
        <div className="hidden md:flex space-x-6">
          <button 
            onClick={() => scrollToSection("mission")} 
            className="text-neutral-dark hover:text-[#0057B8] font-medium transition duration-300"
          >
            Mission
          </button>
          <button 
            onClick={() => scrollToSection("how-it-works")} 
            className="text-neutral-dark hover:text-[#0057B8] font-medium transition duration-300"
          >
            How It Works
          </button>
          <button 
            onClick={() => scrollToSection("demo")} 
            className="text-neutral-dark hover:text-[#0057B8] font-medium transition duration-300"
          >
            Demo
          </button>
          <button 
            onClick={() => scrollToSection("merchandise")} 
            className="text-neutral-dark hover:text-[#0057B8] font-medium transition duration-300"
          >
            Merchandise
          </button>
          
          {/* Resources dropdown */}
          <div className="relative">
            <button 
              onClick={toggleResources}
              className="text-neutral-dark hover:text-[#0057B8] font-medium transition duration-300 flex items-center"
            >
              Resources
              <svg className={`w-4 h-4 ml-1 transform ${resourcesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            
            {resourcesOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <button
                  onClick={() => openExternalPage('/whitepapers.html')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  White Papers
                </button>
                <button
                  onClick={() => openExternalPage('/founder_note.html')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Founder's Note
                </button>
                <button
                  onClick={() => openExternalPage('/signup.html')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile menu button */}
        <button 
          type="button" 
          onClick={toggleMobileMenu} 
          className="md:hidden flex items-center" 
          aria-label="Toggle mobile menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>
      
      {/* Mobile navigation */}
      <div className={`md:hidden bg-white px-4 pb-4 shadow-inner ${mobileMenuOpen ? "" : "hidden"}`}>
        <button 
          onClick={() => scrollToSection("mission")} 
          className="block w-full text-left py-2 px-2 text-neutral-dark hover:bg-neutral-light rounded"
        >
          Mission
        </button>
        <button 
          onClick={() => scrollToSection("how-it-works")} 
          className="block w-full text-left py-2 px-2 text-neutral-dark hover:bg-neutral-light rounded"
        >
          How It Works
        </button>
        <button 
          onClick={() => scrollToSection("demo")} 
          className="block w-full text-left py-2 px-2 text-neutral-dark hover:bg-neutral-light rounded"
        >
          Demo
        </button>
        <button 
          onClick={() => scrollToSection("merchandise")} 
          className="block w-full text-left py-2 px-2 text-neutral-dark hover:bg-neutral-light rounded"
        >
          Merchandise
        </button>
        
        {/* Mobile Resources section */}
        <div className="mt-2 border-t pt-2">
          <div className="font-medium px-2 py-1">Resources:</div>
          <button 
            onClick={() => openExternalPage('/whitepapers.html')} 
            className="block w-full text-left py-2 px-4 text-neutral-dark hover:bg-neutral-light rounded"
          >
            White Papers
          </button>
          <button 
            onClick={() => openExternalPage('/founder_note.html')} 
            className="block w-full text-left py-2 px-4 text-neutral-dark hover:bg-neutral-light rounded"
          >
            Founder's Note
          </button>
          <button 
            onClick={() => openExternalPage('/signup.html')} 
            className="block w-full text-left py-2 px-4 text-neutral-dark hover:bg-neutral-light rounded"
          >
            Sign Up
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
