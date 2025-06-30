import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useRoute } from "wouter";
import type { GrantApplication } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import ApplicationSection from "@/components/application-section";
import FileUploadModal from "@/components/file-upload-modal";
import SignatureCanvas from "@/components/signature-canvas";
import ProgressIndicator from "@/components/progress-indicator";
import AgriculturalReturnForm from "@/components/agricultural-return-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Save, Send } from "lucide-react";

export default function GrantApplication() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/application/:id");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"land_declaration" | "supporting_doc">("land_declaration");

  const applicationId = params?.id ? parseInt(params.id) : null;

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: application, isLoading: applicationLoading } = useQuery<GrantApplication>({
    queryKey: ["/api/grant-applications", applicationId],
    enabled: !!applicationId,
    retry: false,
  });

  const handleDownloadTemplate = () => {
    window.open(`/api/download-template/land-declaration`, '_blank');
  };

  const handleUpload = (type: "land_declaration" | "supporting_doc") => {
    setUploadType(type);
    setUploadModalOpen(true);
  };

  const handleSign = () => {
    setSignatureModalOpen(true);
  };

  const isApplicationComplete = application && 
    application.agriculturalReturnCompleted && 
    application.landDeclarationCompleted && 
    application.consentFormCompleted && 
    application.supportingDocsCompleted;

  if (isLoading || applicationLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 p-6">
            <Card className="text-center py-12">
              <CardContent>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Application Not Found</h3>
                <p className="text-gray-600">
                  The requested application could not be found.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg-light">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6">
          {/* Application Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-text-primary mb-2">RSS Grant Application</h1>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">{application?.year || 2026}</span>
                  <span className="text-gray-400">•</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-custom rounded-full"></div>
                    <span className="text-sm font-medium text-accent-custom capitalize">
                      {application?.status?.replace('_', ' ') || 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              
              <ProgressIndicator 
                percentage={application?.progressPercentage || 0} 
                className="text-right"
              />
            </div>
          </div>

          {/* Application Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ApplicationSection
              title="Agricultural Return"
              description="Submit your annual agricultural return with crop details and land usage"
              completed={Boolean(application?.agriculturalReturnCompleted)}
              estimatedTime="15 minutes"
              primaryAction={{
                label: "Start Return",
                onClick: () => {
                  // TODO: Navigate to agricultural return form
                  toast({
                    title: "Coming Soon",
                    description: "Agricultural return form will be available soon.",
                  });
                },
                variant: "outline",
              }}
            />

            <ApplicationSection
              title="Land Declaration"
              description="Download template and submit land ownership and usage declarations"
              completed={Boolean(application?.landDeclarationCompleted)}
              iconType="download"
              requiresTemplate
              primaryAction={{
                label: "Upload",
                onClick: () => handleUpload("land_declaration"),
                variant: "default",
              }}
              secondaryAction={{
                label: "Download Template",
                onClick: handleDownloadTemplate,
              }}
            />

            <ApplicationSection
              title="Declaration and Consent Form"
              description="Digital signature required for terms and conditions agreement"
              completed={Boolean(application?.consentFormCompleted)}
              iconType="signature"
              requiresSignature
              primaryAction={{
                label: "Sign",
                onClick: handleSign,
                variant: "secondary",
              }}
            />

            <ApplicationSection
              title="Supporting Documentation"
              description="Upload additional documents like land certificates, bank statements"
              completed={Boolean(application?.supportingDocsCompleted)}
              iconType="upload"
              acceptedFormats="PDF, JPG, PNG accepted"
              primaryAction={{
                label: "Upload",
                onClick: () => handleUpload("supporting_doc"),
                variant: "default",
              }}
              secondaryAction={{
                label: "View",
                onClick: () => {
                  // TODO: Navigate to documents view
                  toast({
                    title: "Coming Soon",
                    description: "Document viewer will be available soon.",
                  });
                },
              }}
            />
          </div>

          {/* Application Actions */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <InfoIcon className="text-secondary-custom" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Application Status</p>
                  <p className="text-xs text-gray-600">
                    {isApplicationComplete 
                      ? "All sections complete. Ready to submit your application."
                      : "Complete all sections to submit your application"
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Progress Saved",
                      description: "Your application progress has been saved.",
                    });
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Progress
                </Button>
                <Button 
                  disabled={!isApplicationComplete}
                  className={isApplicationComplete ? "bg-success-custom hover:bg-success-custom/90 text-white" : ""}
                  onClick={() => {
                    if (isApplicationComplete) {
                      toast({
                        title: "Coming Soon",
                        description: "Application submission will be available soon.",
                      });
                    }
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Application
                </Button>
              </div>
            </div>
          </Card>

          {/* Help Section */}
          <Alert className="mt-6 border-secondary-custom/20 bg-secondary-custom/5">
            <InfoIcon className="h-4 w-4 text-secondary-custom" />
            <AlertDescription>
              <span className="font-medium">Need Help?</span> Contact our support team at{" "}
              <a href="mailto:support@rss.gov" className="text-secondary-custom hover:underline">
                support@rss.gov
              </a>{" "}
              or call 1-800-RSS-HELP
            </AlertDescription>
          </Alert>
        </main>
      </div>

      {/* Modals */}
      <FileUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        applicationId={applicationId!}
        documentType={uploadType}
      />

      <SignatureCanvas
        open={signatureModalOpen}
        onOpenChange={setSignatureModalOpen}
        applicationId={applicationId!}
      />
    </div>
  );
}
