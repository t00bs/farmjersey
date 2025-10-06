import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute } from "wouter";
import type { GrantApplication } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import ApplicationSection from "@/components/application-section";
import FileUploadModal from "@/components/file-upload-modal";
import SignatureCanvas from "@/components/signature-canvas";
import DocumentDisplay from "@/components/document-display";
import ProgressIndicator from "@/components/progress-indicator";
import AgriculturalReturnForm from "@/components/agricultural-return-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoIcon, Save, Send, Trash2 } from "lucide-react";

export default function GrantApplication() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/application/:id");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [agriculturalFormOpen, setAgriculturalFormOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
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

  const { data: applicationData, isLoading: applicationLoading } = useQuery<GrantApplication[] | GrantApplication>({
    queryKey: ["/api/grant-applications", applicationId],
    enabled: !!applicationId,
    retry: false,
  });
  
  // Handle both array and single object responses
  const application = Array.isArray(applicationData) ? applicationData[0] : applicationData;
  


  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error("No application ID");
      
      // Just trigger a save to update any cached progress
      return await apiRequest("PATCH", `/api/grant-applications/${applicationId}`, {
        // Send current timestamp to trigger progress recalculation
        lastSaved: new Date().toISOString()
      });
    },
    onSuccess: () => {
      // Invalidate and refetch the application data
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", applicationId] });
      toast({
        title: "Progress Saved",
        description: "Your application progress has been saved successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Save Failed",
        description: "Failed to save your progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Submit application mutation
  const submitApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error("No application ID");
      
      return await apiRequest("PATCH", `/api/grant-applications/${applicationId}`, {
        status: "submitted"
      });
    },
    onSuccess: () => {
      // Invalidate and refetch the application data
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", applicationId] });
      toast({
        title: "Application Submitted",
        description: "Your grant application has been submitted successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Submission Failed",
        description: "Failed to submit your application. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete application mutation (temporary for testing)
  const deleteApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error("No application ID");
      
      return await apiRequest("DELETE", `/api/grant-applications/${applicationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Application Deleted",
        description: "Your application has been deleted successfully.",
      });
      // Redirect to dashboard after deletion
      window.location.href = "/dashboard";
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Delete Failed",
        description: "Failed to delete your application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadTemplate = () => {
    window.open(`/api/download-template/land-declaration`, '_blank');
  };

  const handleUpload = (type: "land_declaration" | "supporting_doc") => {
    setUploadType(type);
    setUploadModalOpen(true);
  };

  // Helper functions to determine section status
  const getAgriculturalReturnStatus = (): "not_started" | "in_progress" | "completed" => {
    if (!application) return "not_started";

    if (application.agriculturalReturnCompleted) return "completed";
    // Check if we have any agricultural progress - even if not fully completed
    if (application.progressPercentage && application.progressPercentage >= 25) return "in_progress"; // Each section is 25%
    return "not_started";
  };

  const getLandDeclarationStatus = (): "not_started" | "in_progress" | "completed" => {
    if (!application) return "not_started";

    if (application.landDeclarationCompleted) return "completed";
    // Check if we have documents uploaded but not marked complete
    if (application.progressPercentage >= 50 && !application.landDeclarationCompleted) return "in_progress";
    return "not_started";
  };

  const getConsentFormStatus = (): "not_started" | "in_progress" | "completed" => {
    if (!application) return "not_started";

    if (application.consentFormCompleted) return "completed";
    // Check if there's partial signature data
    if (application.digitalSignature && !application.consentFormCompleted) return "in_progress";
    return "not_started";
  };

  const getSupportingDocsStatus = (): "not_started" | "in_progress" | "completed" => {
    if (!application) return "not_started";

    if (application.supportingDocsCompleted) return "completed";
    // Check if we have documents uploaded but not marked complete
    if (application.progressPercentage >= 75 && !application.supportingDocsCompleted) return "in_progress";
    return "not_started";
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
                    <div className="w-2 h-2 rounded-full bg-[#237804]"></div>
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
              status={getAgriculturalReturnStatus()}
              estimatedTime="15 minutes"
              primaryAction={{
                label: application?.agriculturalReturnCompleted ? "Edit Return" : "Start Return",
                onClick: () => setAgriculturalFormOpen(true),
                variant: "outline",
              }}
            />

            <ApplicationSection
              title="Land Declaration"
              description="Download template and submit land ownership and usage declarations"
              status={getLandDeclarationStatus()}
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
              status={getConsentFormStatus()}
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
              status={getSupportingDocsStatus()}
              iconType="upload"
              acceptedFormats="PDF, JPG, PNG accepted"
              primaryAction={{
                label: "Upload",
                onClick: () => handleUpload("supporting_doc"),
                variant: "default",
              }}
              secondaryAction={{
                label: "View Documents",
                onClick: () => setDocumentModalOpen(true),
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
                  onClick={() => saveProgressMutation.mutate()}
                  disabled={saveProgressMutation.isPending}
                  data-testid="button-save-progress"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveProgressMutation.isPending ? "Saving..." : "Save Progress"}
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this application? This action cannot be undone.")) {
                      deleteApplicationMutation.mutate();
                    }
                  }}
                  disabled={deleteApplicationMutation.isPending}
                  data-testid="button-delete-application"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteApplicationMutation.isPending ? "Deleting..." : "Delete (Testing)"}
                </Button>
                <Button 
                  disabled={!isApplicationComplete || submitApplicationMutation.isPending}
                  className={isApplicationComplete ? "bg-success-custom hover:bg-success-custom/90 text-white" : ""}
                  onClick={() => {
                    if (isApplicationComplete) {
                      submitApplicationMutation.mutate();
                    }
                  }}
                  data-testid="button-submit-application"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitApplicationMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Help Section */}
          <Alert className="mt-6 border-secondary-custom/20 bg-secondary-custom/5">
            <InfoIcon className="h-4 w-4 text-secondary-custom" />
            <AlertDescription>
              <span className="font-medium">Need Help?</span> Contact our support team at{" "}
              <a href="mailto:support@farmjersey.je" className="text-secondary-custom hover:underline">
                support@farmjersey.je
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
      <DocumentDisplay
        open={documentModalOpen}
        onOpenChange={setDocumentModalOpen}
        applicationId={applicationId!}
      />
      <Dialog open={agriculturalFormOpen} onOpenChange={setAgriculturalFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agricultural Return Form</DialogTitle>
            <DialogDescription>
              Complete your annual agricultural return with crop details and land usage information.
            </DialogDescription>
          </DialogHeader>
          <AgriculturalReturnForm
            applicationId={applicationId!}
            onComplete={() => {
              setAgriculturalFormOpen(false);
              toast({
                title: "Agricultural Return Completed",
                description: "Your agricultural return form has been saved successfully.",
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
