const HeroSection = () => {
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
    <section className="relative bg-gradient-to-r from-[#0057B8] to-[#00A896] text-white overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80')]">
      </div>
      <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold font-heading leading-tight mb-6">A Solar-Backed Global Economic System</h1>
          <p className="text-xl md:text-2xl mb-10">Transforming the future with sustainable finance rooted in renewable energy.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => scrollToSection("demo")}
              className="bg-[#FFD700] text-neutral-dark hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 text-center"
            >
              View Demo
            </button>
            <button
              onClick={() => scrollToSection("mission")}
              className="border-2 border-white hover:bg-white hover:bg-opacity-20 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 text-center"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
