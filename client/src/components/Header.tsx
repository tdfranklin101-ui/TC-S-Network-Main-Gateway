import { useState, useEffect } from "react";
import { Link } from "wouter";
import logo from "../assets/logo.svg";
import { Menu } from "lucide-react";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      const offsetTop = element.offsetTop - 80; // Account for fixed header
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    }
  };

  return (
    <header className={`sticky top-0 z-50 bg-white ${scrolled ? 'shadow-md' : ''}`}>
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <img src={logo} alt="The Current-See Logo" className="h-10 w-10 rounded-full" />
          <span className="ml-2 text-xl font-bold font-heading text-[#0057B8]">Current-See</span>
        </Link>
        
        {/* Desktop navigation */}
        <div className="hidden md:flex space-x-8">
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
      </div>
    </header>
  );
};

export default Header;
