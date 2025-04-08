const MissionSection = () => {
  return (
    <section id="mission" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-center mb-12 text-[#0057B8]">Our Mission</h2>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-lg mb-6">The Current-See PBC, Inc. is building a revolutionary economic system backed by solar energy, designed to create a more sustainable and equitable global financial framework.</p>
              <p className="text-lg mb-6">Our mission is to connect the real value of renewable energy directly to currency, creating a stable foundation for commerce that benefits people and planet.</p>
              <p className="text-lg font-semibold">We are committed to transparently:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Democratizing access to sustainable finance</li>
                <li>Accelerating the transition to renewable energy</li>
                <li>Reducing global carbon emissions</li>
                <li>Building economic resilience through energy independence</li>
              </ul>
            </div>
            <div className="rounded-lg overflow-hidden shadow-xl">
              <div className="w-full h-full aspect-[6/5] bg-[url('https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&h=500&q=80')] bg-cover bg-center"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MissionSection;
