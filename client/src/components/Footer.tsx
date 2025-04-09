import { Facebook, Twitter, Linkedin, Mail, MapPin } from "lucide-react";
import logo from "../assets/logo.svg";

const Footer = () => {
  const scrollToSection = (sectionId: string) => {
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
    <footer className="bg-[#212529] text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <img src={logo} alt="The Current-See Logo" className="h-10 w-10 rounded-full" />
              <span className="ml-2 text-xl font-bold font-heading text-[#FFD700]">Current-See</span>
            </div>
            <p className="mb-4">Building a sustainable economic future through solar-backed currency.</p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-[#FFD700] transition">
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-white hover:text-[#FFD700] transition">
                <Twitter className="h-6 w-6" />
              </a>
              <a href="#" className="text-white hover:text-[#FFD700] transition">
                <Linkedin className="h-6 w-6" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><button onClick={() => scrollToSection("mission")} className="hover:text-[#FFD700] transition">Our Mission</button></li>
              <li><button onClick={() => scrollToSection("how-it-works")} className="hover:text-[#FFD700] transition">How It Works</button></li>
              <li><button onClick={() => scrollToSection("demo")} className="hover:text-[#FFD700] transition">Demo</button></li>
              <li><button onClick={() => scrollToSection("merchandise")} className="hover:text-[#FFD700] transition">Merchandise</button></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-[#FFD700] transition">White Paper</a></li>
              <li><a href="#" className="hover:text-[#FFD700] transition">Technical Documentation</a></li>
              <li><a href="#" className="hover:text-[#FFD700] transition">FAQs</a></li>
              <li><a href="#" className="hover:text-[#FFD700] transition">Blog</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <Mail className="h-5 w-5 mr-2 mt-0.5" />
                <span>info@thecurrentsee.org</span>
              </li>
              <li className="flex items-start">
                <MapPin className="h-5 w-5 mr-2 mt-0.5" />
                <span>San Francisco, CA</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-10 pt-8 text-center text-sm opacity-70">
          <p>&copy; {new Date().getFullYear()} The Current-See PBC, Inc.</p>
          <p><a href="/admin" style={{fontSize: "0.9em"}} className="hover:text-[#FFD700] transition">Admin</a></p>
          <div className="mt-2 space-x-4">
            <a href="#" className="hover:text-[#FFD700] transition">Privacy Policy</a>
            <a href="#" className="hover:text-[#FFD700] transition">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
