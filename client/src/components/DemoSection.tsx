import { Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const DemoSection = () => {
  const fundingProgress = 35; // 35% progress

  return (
    <section id="demo" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold font-heading text-center mb-8 text-[#0057B8]">Interactive Demo</h2>
        <p className="text-lg text-center max-w-3xl mx-auto mb-12">Experience our working prototype and see how The Current-See is bringing solar-backed currency to life.</p>
        
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="rounded-lg overflow-hidden shadow-xl border-2 border-[#0057B8]">
            {/* Demo iframe/placeholder */}
            <div className="w-full aspect-video bg-[#F8F9FA] p-4">
              <div className="w-full h-full flex items-center justify-center bg-[#0057B8] bg-opacity-10 rounded">
                <div className="text-center">
                  <Play className="h-16 w-16 mx-auto text-[#0057B8] opacity-50" />
                  <p className="mt-4 text-xl font-medium">Loading Demo...</p>
                  <p className="mt-2 text-sm">Interactive prototype will appear here.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-2xl font-bold mb-6">Fund Our Progress</h3>
            <p className="mb-6">We're seeking funding to complete development of our full-scale system. Your support helps us accelerate the transition to a solar-backed economy.</p>
            
            <div className="mb-8 bg-[#F8F9FA] p-6 rounded-lg">
              <h4 className="text-xl font-semibold mb-4">Funding Progress</h4>
              <Progress value={fundingProgress} className="h-6 mb-2" />
              <p className="text-sm text-gray-600">${fundingProgress}0,000 raised of $1,000,000 goal</p>
            </div>
            
            <div className="space-y-4">
              <a href="#" className="block w-full bg-[#0057B8] text-white hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 text-center">
                Become an Investor
              </a>
              <a href="#" className="block w-full bg-[#00A896] text-white hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 text-center">
                Make a Donation
              </a>
              <button
                onClick={() => {
                  const element = document.getElementById("merchandise");
                  if (element) {
                    const offsetTop = element.offsetTop - 80;
                    window.scrollTo({
                      top: offsetTop,
                      behavior: "smooth",
                    });
                  }
                }}
                className="block w-full border-2 border-[#FFD700] text-neutral-dark hover:bg-[#FFD700] hover:bg-opacity-10 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 text-center"
              >
                Support Through Merchandise
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
