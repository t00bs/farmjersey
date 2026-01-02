import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["/api/grant-applications"],
    retry: false,
  });

  const createApplicationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/grant-applications", {
        year: new Date().getFullYear(),
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications"] });
      toast({
        title: "Success",
        description: "New grant application created successfully!",
      });
    },
    onError: (error: any) => {
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
      
      // Handle the specific case of duplicate application for the year
      if (error.status === 409) {
        toast({
          title: "Application Already Exists",
          description: "You already have a grant application for this year. Only one application per year is allowed.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to create grant application. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading || applicationsLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "in_progress":
        return <Badge className="bg-accent-custom text-white">In Progress</Badge>;
      case "submitted":
        return <Badge className="bg-secondary-custom text-white">Submitted</Badge>;
      case "approved":
        return <Badge className="bg-success-custom text-white">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Check if user already has an application for current year
  const currentYear = new Date().getFullYear();
  const hasCurrentYearApplication = applications && applications.some((app: any) => app.year === currentYear);
  const canCreateNewApplication = !hasCurrentYearApplication;

  return (
    <div className="min-h-screen flex bg-bg-light">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">Grant Applications</h1>
              <p className="text-gray-600">Manage your rural support grant applications</p>
            </div>
            {canCreateNewApplication ? (
              <Button
                onClick={() => createApplicationMutation.mutate()}
                disabled={createApplicationMutation.isPending}
                className="bg-primary-custom hover:bg-primary-custom/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Application
              </Button>
            ) : (
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-2">
                  You already have an application for {currentYear}
                </p>
                <Button
                  disabled
                  variant="outline"
                  className="opacity-50 cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Application
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  New applications available January 1st, {currentYear + 1}
                </p>
              </div>
            )}
          </div>

          {/* Applications Grid */}
          {applications && applications.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {applications.map((application: any) => (
                <Card key={application.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-text-primary">
                          RSS Grant Application
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {application.year} • Application #{application.id}
                        </p>
                      </div>
                      {getStatusBadge(application.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium text-primary-custom">
                            {(application.status === "submitted" || application.status === "approved" || application.status === "rejected") 
                              ? "100" 
                              : application.progressPercentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-custom h-2 rounded-full transition-all"
                            style={{ width: `${(application.status === "submitted" || application.status === "approved" || application.status === "rejected") ? 100 : application.progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Status Items */}
                      <div className="space-y-2">
                        {(() => {
                          const isFinalized = application.status === "submitted" || application.status === "approved" || application.status === "rejected";
                          return (
                            <>
                              <div className="flex items-center space-x-2 text-sm">
                                {(isFinalized || application.agriculturalReturnCompleted) ? (
                                  <CheckCircle className="w-4 h-4 text-success-custom" />
                                ) : (
                                  <Clock className="w-4 h-4 text-gray-400" />
                                )}
                                <span className={(isFinalized || application.agriculturalReturnCompleted) ? "text-success-custom" : "text-gray-600"}>
                                  Agricultural Return
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                {(isFinalized || application.landDeclarationCompleted) ? (
                                  <CheckCircle className="w-4 h-4 text-success-custom" />
                                ) : (
                                  <Clock className="w-4 h-4 text-gray-400" />
                                )}
                                <span className={(isFinalized || application.landDeclarationCompleted) ? "text-success-custom" : "text-gray-600"}>
                                  Land Declaration
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                {(isFinalized || application.supportingDocsCompleted) ? (
                                  <CheckCircle className="w-4 h-4 text-success-custom" />
                                ) : (
                                  <Clock className="w-4 h-4 text-gray-400" />
                                )}
                                <span className={(isFinalized || application.supportingDocsCompleted) ? "text-success-custom" : "text-gray-600"}>
                                  Supporting Documents
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Action Button */}
                      <Link href={`/application/${application.id}`}>
                        <Button className="w-full mt-4 bg-white border-2 border-primary-custom text-primary-custom hover:bg-primary-custom hover:text-white">
                          <FileText className="w-4 h-4 mr-2" />
                          {application.status === "submitted" || application.status === "approved" || application.status === "rejected" 
                            ? "View Application" 
                            : application.status === "draft" 
                              ? "Start Application" 
                              : "Continue Application"}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications Yet</h3>
                <p className="text-gray-600 mb-6">
                  Get started by creating your first grant application for {currentYear}
                </p>
                <Button
                  onClick={() => createApplicationMutation.mutate()}
                  disabled={createApplicationMutation.isPending}
                  className="bg-primary-custom hover:bg-primary-custom/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Application
                </Button>
                <p className="text-xs text-gray-500 mt-3">
                  Only one application per year allowed
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
