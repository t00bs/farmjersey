import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, FileText, Shield, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-custom rounded-lg flex items-center justify-center">
                <Sprout className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Rural Support Scheme Portal</h1>
                <p className="text-sm text-gray-600">Government Grant Application System</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-primary-custom hover:bg-primary-custom/90 text-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-text-primary mb-6">
            Apply for Rural Support Grants
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            A streamlined digital platform for farmers to apply for government grants, 
            manage applications, and access rural support services.
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-primary-custom hover:bg-primary-custom/90 text-white text-lg py-6 px-8"
          >
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-text-primary mb-12">
            Key Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-primary-custom/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="text-primary-custom" size={24} />
                </div>
                <CardTitle className="text-lg">Digital Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Complete grant applications online with step-by-step guidance and real-time validation.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-secondary-custom/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-secondary-custom" size={24} />
                </div>
                <CardTitle className="text-lg">Secure Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Government-grade security with digital signatures and encrypted document storage.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-success-custom/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Sprout className="text-success-custom" size={24} />
                </div>
                <CardTitle className="text-lg">Agricultural Focus</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Specialized forms for agricultural returns, land declarations, and crop reporting.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-accent-custom/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="text-accent-custom" size={24} />
                </div>
                <CardTitle className="text-lg">Expert Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Dedicated support team to help you through the application process.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary-custom">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Apply?
          </h3>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of farmers who have successfully secured grants through our platform.
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-white text-primary-custom hover:bg-gray-100 text-lg py-6 px-8"
          >
            Start Your Application
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-lg font-semibold mb-4">Rural Support Scheme</h4>
              <p className="text-gray-300">
                Supporting rural communities through accessible grant applications and agricultural assistance.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact</h4>
              <p className="text-gray-300">
                Email: support@rss.gov<br />
                Phone: 1-800-RSS-HELP
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <p className="text-gray-300">
                Application Guidelines<br />
                FAQ & Support<br />
                Document Templates
              </p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Rural Support Scheme Portal. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
