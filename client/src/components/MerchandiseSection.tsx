import { Product } from "@/lib/types";

const MerchandiseSection = () => {
  const products: Product[] = [
    {
      id: 1,
      name: "Solar Future T-Shirt",
      description: "100% organic cotton t-shirt featuring our \"Power the Future\" design.",
      price: 29.99,
      image: "https://images.unsplash.com/photo-1618354691792-d1d42acfd860?auto=format&fit=crop&w=600&h=400&q=80",
      isNew: true
    },
    {
      id: 2,
      name: "Solar Power Bank",
      description: "10,000mAh solar-rechargeable power bank with Current-See branding.",
      price: 49.99,
      image: "https://images.unsplash.com/photo-1603557244695-37478f2ef0c1?auto=format&fit=crop&w=600&h=400&q=80",
      isNew: false
    },
    {
      id: 3,
      name: "Insulated Water Bottle",
      description: "Stainless steel insulated bottle with our mission statement and logo.",
      price: 34.99,
      image: "https://images.unsplash.com/photo-1618403323851-eb733d77465b?auto=format&fit=crop&w=600&h=400&q=80",
      isNew: false
    }
  ];

  return (
    <section id="merchandise" className="py-16 md:py-24 bg-[#F8F9FA]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold font-heading text-center mb-8 text-[#0057B8]">Support Our Mission</h2>
        <p className="text-lg text-center max-w-3xl mx-auto mb-12">Every purchase directly supports the development of The Current-See ecosystem while spreading awareness.</p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg overflow-hidden shadow-lg transition duration-300 hover:shadow-xl">
              <div className="relative">
                <div className="w-full h-64 bg-cover bg-center" style={{ backgroundImage: `url(${product.image})` }}></div>
                {product.isNew && (
                  <div className="absolute top-0 right-0 bg-[#FFD700] text-neutral-dark text-sm font-bold px-3 py-1 m-2 rounded">
                    New
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                <p className="text-gray-600 mb-4">{product.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold">${product.price.toFixed(2)}</span>
                  <button className="bg-[#0057B8] text-white px-4 py-2 rounded font-medium hover:bg-opacity-90 transition">Add to Cart</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <a href="#" className="inline-block bg-[#FFD700] text-neutral-dark hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300">
            View All Merchandise
          </a>
        </div>
      </div>
    </section>
  );
};

export default MerchandiseSection;
