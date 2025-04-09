import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Footer from "../components/Footer";

export default function NotFound() {
  return (
    <>
      <div className="min-h-[70vh] w-full flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-gray-600 mb-4">
              The page you are looking for doesn't exist or has been moved.
            </p>
            
            <a href="/" className="inline-block bg-[#0057B8] text-white hover:bg-opacity-90 font-medium py-2 px-4 rounded transition duration-300">
              Return to Home
            </a>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}
