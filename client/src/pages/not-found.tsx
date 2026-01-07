import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import logoPath from "@assets/FJ_Dark_1767792013780.png";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="text-center max-w-md">
        <Link href="/">
          <img 
            src={logoPath} 
            alt="Farm Jersey" 
            className="h-16 mx-auto mb-8 cursor-pointer hover:opacity-80 transition-opacity" 
            data-testid="logo-404"
          />
        </Link>
        
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-primary-custom mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Page Not Found</h2>
          <p className="text-gray-600 leading-relaxed">
            Sorry, we couldn't find the page you're looking for. 
            It might have been moved or doesn't exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button 
              className="w-full sm:w-auto bg-primary-custom hover:bg-primary-custom/90"
              data-testid="button-return-home"
            >
              <Home className="w-4 h-4 mr-2" />
              Return to Home
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
            data-testid="button-go-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Need help? Contact us at{" "}
          <a 
            href="mailto:help@farmjersey.je" 
            className="text-primary-custom hover:underline"
            data-testid="link-support-email"
          >
            help@farmjersey.je
          </a>
        </p>
      </div>
    </div>
  );
}
