import { Button } from "@/components/ui/button";
import { FileCheck, Shield, Users, Sprout, Download, TrendingUp } from "lucide-react";
import logoPath from "@assets/FJ_Dark_1767792013780.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-transparent" data-testid="header">
        <div className="container mx-auto px-4 sm:px-8 lg:px-[120px] py-6 flex items-center justify-between">
          <img src={logoPath} alt="Farm Jersey" className="h-10 invert" data-testid="logo-header" />
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-white hover:bg-gray-100 text-[#231f20] px-6 py-2 h-auto font-medium text-base"
            data-testid="button-login"
          >
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="relative min-h-[720px] flex items-center justify-center px-4 sm:px-8 lg:px-[120px] py-[142px]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url(https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920&h=1080&fit=crop)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="hero-section"
      >
        <div className="container mx-auto flex items-center justify-center gap-12 relative z-10">
          <div className="flex flex-col items-start gap-2.5 pb-0 pt-5 px-0 self-stretch shrink-0">
            <div className="flex items-center justify-center">
              <svg width="66" height="131" viewBox="0 0 66 131" fill="none" className="transform rotate-180 scale-y-[-1]">
                <path d="M33 0L66 65.5L33 131L0 65.5L33 0Z" fill="white" opacity="0.3"/>
              </svg>
            </div>
          </div>
          
          <div className="flex flex-col items-center max-w-[912px] shrink-0">
            <div className="flex flex-col items-start w-full mb-8">
              <h1 
                className="text-white text-[82px] leading-[1.1] tracking-[-1.804px] text-center w-full font-normal"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                data-testid="hero-heading"
              >
                Get Involved In Jersey's Local Food Economy.
              </h1>
            </div>
            
            <div className="flex gap-2 items-start pt-2" data-testid="hero-buttons">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#c69a71] hover:bg-[#b88960] text-[#231f20] px-3 py-2 h-auto font-medium text-base tracking-[-0.176px]"
                data-testid="button-apply-grant"
              >
                Apply for a grant
              </Button>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#aaf7a6] hover:bg-[#98e594] text-[#231f20] px-3 py-2 h-auto font-medium text-base tracking-[-0.176px]"
                data-testid="button-find-producers"
              >
                Find Local Producers
              </Button>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-transparent hover:bg-white/10 text-white border border-white px-3 py-2 h-auto font-medium text-base tracking-[-0.176px]"
                data-testid="button-business-support"
              >
                Get Business Support
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col items-start gap-2.5 pb-0 pt-5 px-0 self-stretch shrink-0">
            <div className="flex items-center justify-center">
              <svg width="66" height="131" viewBox="0 0 66 131" fill="none">
                <path d="M33 0L66 65.5L33 131L0 65.5L33 0Z" fill="white" opacity="0.3"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="bg-[#c69a71] px-4 sm:px-8 lg:px-[120px] py-16" data-testid="testimonial-section">
        <div className="container mx-auto flex flex-col items-center max-w-[600px]">
          <div className="flex gap-2.5 items-center pb-6">
            <svg width="42" height="62" viewBox="0 0 42 62" fill="none">
              <path d="M21 0L42 31L21 62L0 31L21 0Z" fill="#231f20" opacity="0.2"/>
            </svg>
          </div>
          
          <div className="flex flex-col items-start w-full pb-5">
            <p 
              className="text-[#231f20] text-[36px] leading-[44px] tracking-[-0.756px] text-center w-full font-normal"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              data-testid="testimonial-quote"
            >
              "Farm Jersey exists to help our rural and marine economy thrive. They provide resources and a funding pathway to drive our food economy towards a sovereign and sustainable model for generations.
            </p>
          </div>
          
          <div className="flex flex-col items-start w-full">
            <p 
              className="text-[#231f20] text-[21px] leading-[32px] tracking-[-0.294px] text-center w-full font-normal"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              data-testid="testimonial-author"
            >
              John Vautier, Senior Lead for the Rural and Marine Economy
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white px-4 sm:px-8 lg:px-[120px] py-16 pt-16 pb-6" data-testid="features-section">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#231f20] border border-[#231f20] p-6 flex flex-col gap-4" data-testid="card-digital-applications">
              <div className="w-12 h-12 flex items-center justify-center">
                <FileCheck className="text-white" size={48} />
              </div>
              <h3 className="text-white text-xl font-medium">Digital Applications</h3>
              <p className="text-white/80">
                Complete grant applications online with step-by-step guidance and real-time validation for agricultural support schemes.
              </p>
            </div>

            <div className="bg-[#231f20] border border-[#231f20] p-6 flex flex-col gap-4" data-testid="card-secure-platform">
              <div className="w-12 h-12 flex items-center justify-center">
                <Shield className="text-white" size={48} />
              </div>
              <h3 className="text-white text-xl font-medium">Secure Platform</h3>
              <p className="text-white/80">
                Government-grade security with digital signatures, encrypted document storage, and secure authentication.
              </p>
            </div>

            <div className="bg-[#231f20] border border-[#231f20] p-6 flex flex-col gap-4" data-testid="card-document-management">
              <div className="w-12 h-12 flex items-center justify-center">
                <Download className="text-white" size={48} />
              </div>
              <h3 className="text-white text-xl font-medium">Document Management</h3>
              <p className="text-white/80">
                Upload and manage land declarations, agricultural returns, and supporting documents all in one place.
              </p>
            </div>

            <div className="bg-[#231f20] border border-[#231f20] p-6 flex flex-col gap-4" data-testid="card-agricultural-focus">
              <div className="w-12 h-12 flex items-center justify-center">
                <Sprout className="text-white" size={48} />
              </div>
              <h3 className="text-white text-xl font-medium">Agricultural Focus</h3>
              <p className="text-white/80">
                Specialized forms for agricultural returns, crop reporting, and land management designed for Jersey farmers.
              </p>
            </div>

            <div className="bg-[#231f20] border border-[#231f20] p-6 flex flex-col gap-4" data-testid="card-progress-tracking">
              <div className="w-12 h-12 flex items-center justify-center">
                <TrendingUp className="text-white" size={48} />
              </div>
              <h3 className="text-white text-xl font-medium">Progress Tracking</h3>
              <p className="text-white/80">
                Track your application status in real-time with detailed progress indicators and completion percentages.
              </p>
            </div>

            <div className="bg-[#231f20] border border-[#231f20] p-6 flex flex-col gap-4" data-testid="card-expert-support">
              <div className="w-12 h-12 flex items-center justify-center">
                <Users className="text-white" size={48} />
              </div>
              <h3 className="text-white text-xl font-medium">Expert Support</h3>
              <p className="text-white/80">
                Dedicated support team to help you through the application process and answer your questions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#231f20] text-white py-12" data-testid="footer">
        <div className="container mx-auto px-4 sm:px-8 lg:px-[120px]">
          <div className="flex flex-col items-center gap-6">
            <img src={logoPath} alt="Farm Jersey" className="h-12" data-testid="logo-footer" />
            <p className="text-white/80 text-center max-w-2xl">
              Supporting Jersey's rural and marine economy through accessible grant applications and agricultural assistance.
            </p>
            <div className="border-t border-white/20 w-full pt-6 text-center">
              <p className="text-white/60">&copy; 2025 Farm Jersey. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
