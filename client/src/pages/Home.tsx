import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import MissionSection from "@/components/MissionSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import DemoSection from "@/components/DemoSection";
import MerchandiseSection from "@/components/MerchandiseSection";
import NewsletterSection from "@/components/NewsletterSection";
import Footer from "@/components/Footer";

const Home = () => {
  return (
    <div className="font-body bg-[#F8F9FA] text-[#212529]">
      <Header />
      <HeroSection />
      <MissionSection />
      <HowItWorksSection />
      <DemoSection />
      <MerchandiseSection />
      <NewsletterSection />
      <Footer />
    </div>
  );
};

export default Home;
