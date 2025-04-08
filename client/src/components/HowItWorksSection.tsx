import { Check } from "lucide-react";

const HowItWorksSection = () => {
  // Step data
  const steps = [
    {
      number: 1,
      title: "Solar Energy Generation",
      description: "Energy from solar panels is measured and tracked in real-time using our transparent monitoring system."
    },
    {
      number: 2,
      title: "Value Conversion",
      description: "The energy produced is converted to economic value through our proprietary algorithm, creating a direct link."
    },
    {
      number: 3,
      title: "Distributed Economy",
      description: "This value becomes the foundation of our economic system, allowing for transactions backed by real, renewable energy."
    }
  ];

  // Benefits data
  const benefits = [
    {
      title: "Stability",
      description: "Backed by physical energy production, providing inherent value and protection against inflation"
    },
    {
      title: "Transparency",
      description: "Open verification of energy production and value creation through distributed ledger technology"
    },
    {
      title: "Sustainability",
      description: "Incentivizes renewable energy adoption by directly tying economic value to clean energy production"
    },
    {
      title: "Accessibility",
      description: "Designed to be inclusive and accessible globally, regardless of existing financial infrastructure"
    }
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-[#F8F9FA]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold font-heading text-center mb-16 text-[#0057B8]">How It Works</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="bg-white p-8 rounded-lg shadow-lg text-center">
              <div className="bg-[#0057B8] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">{step.number}</span>
              </div>
              <h3 className="text-xl font-bold mb-4">{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-16 bg-white p-8 rounded-lg shadow-lg">
          <h3 className="text-2xl font-bold mb-6 text-center">Key System Benefits</h3>
          <div className="grid md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start">
                <div className="flex-shrink-0 mr-4">
                  <Check className="h-6 w-6 text-[#00A896]" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">{benefit.title}</h4>
                  <p>{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
