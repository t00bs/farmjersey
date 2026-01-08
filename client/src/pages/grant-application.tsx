import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useRoute, useLocation } from "wouter";
import type { GrantApplication } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import ApplicationSection from "@/components/application-section";
import FileUploadModal from "@/components/file-upload-modal";
import DocumentDisplay from "@/components/document-display";
import ProgressIndicator from "@/components/progress-indicator";
import AgriculturalReturnWizard from "@/components/agricultural-return-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoIcon, Save, Send, Trash2, ExternalLink, Download } from "lucide-react";
import type { AgriculturalReturn } from "@shared/schema";
import { downloadWithAuth } from "@/lib/queryClient";

export default function GrantApplication() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/application/:publicId");
  const [, navigate] = useLocation();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [agriculturalFormOpen, setAgriculturalFormOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"land_declaration" | "supporting_doc">("land_declaration");

  const publicId = params?.publicId || null;

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
    queryKey: ["/api/grant-applications", publicId],
    enabled: !!publicId,
    retry: false,
  });
  
  // Handle both array and single object responses
  const application = Array.isArray(applicationData) ? applicationData[0] : applicationData;
  
  // Get numeric ID for internal operations (document uploads, etc.)
  const applicationId = application?.id || null;

  // Fetch agricultural return to get its ID for PDF download
  const { data: agriculturalReturn } = useQuery<AgriculturalReturn>({
    queryKey: [`/api/agricultural-returns/${applicationId}`],
    enabled: !!applicationId && !!application?.agriculturalReturnCompleted,
  });
  


  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async () => {
      if (!publicId) throw new Error("No application ID");
      
      // Just trigger a save to update any cached progress
      return await apiRequest("PATCH", `/api/grant-applications/${publicId}`, {
        // Send current timestamp to trigger progress recalculation
        lastSaved: new Date().toISOString()
      });
    },
    onSuccess: () => {
      // Invalidate and refetch the application data
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", publicId] });
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
      if (!publicId) throw new Error("No application ID");
      
      return await apiRequest("PATCH", `/api/grant-applications/${publicId}`, {
        status: "submitted"
      });
    },
    onSuccess: () => {
      // Invalidate all application queries including this specific one, then redirect to home
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", publicId] });
      toast({
        title: "Application Submitted",
        description: "Your grant application has been submitted successfully.",
      });
      navigate("/");
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
      if (!publicId) throw new Error("No application ID");
      
      return await apiRequest("DELETE", `/api/grant-applications/${publicId}`);
    },
    onSuccess: async () => {
      toast({
        title: "Application Deleted",
        description: "Your application has been deleted successfully.",
      });
      // Remove cached data entirely to force fresh fetch on home page
      queryClient.removeQueries({ queryKey: ["/api/grant-applications"] });
      // Also clear any specific application cache
      queryClient.removeQueries({ queryKey: ["/api/grant-applications", publicId] });
      navigate("/");
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

  const handleDownloadPDF = async () => {
    if (!agriculturalReturn?.id) {
      toast({
        title: "PDF not available",
        description: "Please complete the agricultural return first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const farmName = (agriculturalReturn.farmDetailsData as any)?.farmName || 'Farm';
      const fileName = `RSS_Application_2026_${farmName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      await downloadWithAuth(`/api/agricultural-returns/${agriculturalReturn.id}/pdf`, fileName);
      toast({
        title: "PDF Downloaded",
        description: "Your agricultural return PDF has been downloaded.",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: "Authentication required",
          description: "Please sign in to download the template.",
          variant: "destructive",
        });
        return;
      }

      // Fetch the file with authentication
      const response = await fetch('/api/download-template/land-declaration', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Agricultural_Return_2025_for_2026_Reward.xlsx';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Template downloaded",
        description: "The land declaration template has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        title: "Download failed",
        description: "Failed to download the template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isReadOnly = application?.status === "submitted" || application?.status === "approved" || application?.status === "rejected";

  const handleUpload = (type: "land_declaration" | "supporting_doc") => {
    if (isReadOnly) return;
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

  const getSupportingDocsStatus = (): "not_started" | "in_progress" | "completed" => {
    if (!application) return "not_started";

    if (application.supportingDocsCompleted) return "completed";
    // Check if we have documents uploaded but not marked complete
    if (application.progressPercentage >= 75 && !application.supportingDocsCompleted) return "in_progress";
    return "not_started";
  };

  const isApplicationComplete = application && 
    application.agriculturalReturnCompleted && 
    application.landDeclarationCompleted && 
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
                    <span className="text-sm font-medium capitalize text-[#237804]">
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
            
            <a 
              href="/api/download-template/rss-guidance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-primary-custom hover:underline"
              data-testid="link-download-guidance"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Download Rural Support Scheme Guidance
            </a>
          </div>

          {/* Application Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ApplicationSection
              title="Agricultural Return"
              description="Submit your annual agricultural return with crop details and land usage"
              status={getAgriculturalReturnStatus()}
              estimatedTime="15 minutes"
              disabled={isReadOnly && !application?.agriculturalReturnCompleted}
              primaryAction={{
                label: application?.agriculturalReturnCompleted ? "View Return" : "Start Return",
                onClick: () => (!isReadOnly || application?.agriculturalReturnCompleted) && setAgriculturalFormOpen(true),
                variant: "outline",
              }}
              secondaryAction={application?.agriculturalReturnCompleted ? {
                label: "Download PDF",
                onClick: handleDownloadPDF,
                icon: <Download className="w-4 h-4 mr-1" />,
              } : undefined}
            />

            <ApplicationSection
              title="Land Declaration"
              description="Download template and submit land ownership and usage declarations"
              status={getLandDeclarationStatus()}
              iconType="download"
              requiresTemplate
              templateDownload={{
                label: "Download Excel Template",
                onClick: handleDownloadTemplate,
              }}
              primaryAction={{
                label: "View Documents",
                onClick: () => setDocumentModalOpen(true),
                variant: "default",
              }}
              secondaryAction={isReadOnly ? undefined : {
                label: "Upload",
                onClick: () => handleUpload("land_declaration"),
              }}
            />

            <ApplicationSection
              title="Supporting Documentation"
              description="Upload additional documents like accreditation certificates, accounts, qualification certification or any other evidence which supports your RSS application"
              status={getSupportingDocsStatus()}
              iconType="upload"
              acceptedFormats="PDF, JPG, PNG accepted"
              primaryAction={{
                label: "View Documents",
                onClick: () => setDocumentModalOpen(true),
                variant: "default",
              }}
              secondaryAction={isReadOnly ? undefined : {
                label: "Upload",
                onClick: () => handleUpload("supporting_doc"),
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
              
              {isReadOnly ? (
                <div className="text-center py-2 px-4 bg-primary-custom/10 text-primary-custom rounded-lg font-medium">
                  Application {application?.status === "submitted" ? "Submitted" : application?.status === "approved" ? "Approved" : "Rejected"} - View Only
                </div>
              ) : (
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
              )}
            </div>
          </Card>
        </main>
      </div>
      {/* Modals */}
      <FileUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        applicationId={applicationId!}
        documentType={uploadType}
      />
      <DocumentDisplay
        open={documentModalOpen}
        onOpenChange={setDocumentModalOpen}
        applicationId={applicationId!}
      />
      <Dialog open={agriculturalFormOpen} onOpenChange={setAgriculturalFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <AgriculturalReturnWizard
            applicationId={applicationId!}
            readOnly={isReadOnly}
            onComplete={() => {
              setAgriculturalFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/grant-applications"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
