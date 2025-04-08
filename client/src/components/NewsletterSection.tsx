import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
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
    <section className="py-16 bg-[#0057B8] text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-heading mb-6">Stay Updated</h2>
          <p className="text-lg mb-8">Join our newsletter to receive updates on our progress, solar economy news, and exclusive early access to new features.</p>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
            <Input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-grow px-4 py-3 rounded-lg text-neutral-dark focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
            />
            <Button 
              type="submit" 
              className="bg-[#FFD700] text-neutral-dark hover:bg-opacity-90 font-bold py-3 px-8 rounded-lg transition duration-300"
            >
              Subscribe
            </Button>
          </form>
          <p className="text-sm mt-4 opacity-80">We respect your privacy and will never share your information.</p>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
