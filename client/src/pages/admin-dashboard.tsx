import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Eye, FileText, Calendar, User, AlertTriangle, CheckCircle, FormInput } from "lucide-react";
import type { GrantApplication, AgriculturalReturn, Document, ApplicationWithUserData, AgriculturalFormResponse } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithUserData | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["/api/admin/applications", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? "/api/admin/applications"
        : `/api/admin/applications?status=${statusFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch applications");
      return await response.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/applications/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({
        title: "Status Updated",
        description: "Application status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update application status.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { label: "Draft", variant: "secondary" as const },
      in_progress: { label: "In Progress", variant: "default" as const },
      submitted: { label: "Submitted", variant: "outline" as const },
      approved: { label: "Approved", variant: "default" as const },
      rejected: { label: "Rejected", variant: "destructive" as const },
    }[status];

    if (!config) {
      return (
        <Badge variant="secondary">
          Unknown
        </Badge>
      );
    }
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const getStatusStats = () => {
    const stats = applications.reduce((acc: any, app: ApplicationWithUserData) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: applications.length,
      submitted: stats.submitted || 0,
      approved: stats.approved || 0,
      rejected: stats.rejected || 0,
      pending: (stats.submitted || 0) + (stats.in_progress || 0),
    };
  };

  const stats = getStatusStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Admin Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  Review and manage grant applications
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.location.href = '/admin/form-builder'}>
                  <FormInput className="h-4 w-4 mr-2" />
                  Form Builder
                </Button>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Approved</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.approved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.rejected}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Applications</CardTitle>
                <CardDescription>Filter applications by status</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Applications</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Applications Table */}
            <Card>
              <CardHeader>
                <CardTitle>Applications</CardTitle>
                <CardDescription>
                  {statusFilter === "all" ? "All applications" : `Applications with status: ${statusFilter}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User Name</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((application: ApplicationWithUserData) => (
                      <TableRow key={application.id}>
                        <TableCell>#{application.id}</TableCell>
                        <TableCell>
                          {application.userFirstName && application.userLastName
                            ? `${application.userFirstName} ${application.userLastName}`
                            : application.userEmail || application.userId
                          }
                        </TableCell>
                        <TableCell>{application.year}</TableCell>
                        <TableCell>{getStatusBadge(application.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Progress value={application.progressPercentage} className="w-16" />
                            <span className="text-sm">{application.progressPercentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedApplication(application)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  Application #{selectedApplication?.id} Review
                                </DialogTitle>
                                <DialogDescription>
                                  Review application details and update status
                                </DialogDescription>
                              </DialogHeader>
                              {selectedApplication && (
                                <ApplicationReviewDialogContent 
                                  application={selectedApplication}
                                  onStatusUpdate={(status) => {
                                    updateStatusMutation.mutate({
                                      id: selectedApplication.id,
                                      status,
                                    });
                                  }}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Need Help Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  If you need assistance with application reviews or have questions about the system, please contact our support team.
                </p>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => window.open('mailto:support@farmjersey.je')}>
                    Email Support
                  </Button>
                  <Button variant="outline">
                    View Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

function ApplicationReviewDialogContent({ 
  application, 
  onStatusUpdate 
}: { 
  application: ApplicationWithUserData; 
  onStatusUpdate: (status: string) => void;
}) {
  const [newStatus, setNewStatus] = useState(application.status);

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/applications", application.id, "documents"],
  });

  const { data: agriculturalReturn } = useQuery<AgriculturalFormResponse | null>({
    queryKey: ["/api/admin/applications", application.id, "agricultural-response"],
    retry: false,
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agricultural">Agricultural Return</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Application Details</h4>
              <div className="space-y-2 text-sm">
                <div><strong>ID:</strong> #{application.id}</div>
                <div><strong>User:</strong> {application.userFirstName && application.userLastName ? `${application.userFirstName} ${application.userLastName}` : application.userEmail || application.userId}</div>
                <div><strong>Email:</strong> {application.userEmail || 'Not available'}</div>
                <div><strong>User ID:</strong> {application.userId}</div>
                <div><strong>Year:</strong> {application.year}</div>
                <div><strong>Status:</strong> {application.status}</div>
                <div><strong>Progress:</strong> {application.progressPercentage}%</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Completion Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <CheckCircle className={`h-4 w-4 mr-2 ${application.agriculturalReturnCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                  Agricultural Return
                </div>
                <div className="flex items-center">
                  <CheckCircle className={`h-4 w-4 mr-2 ${application.landDeclarationCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                  Land Declaration
                </div>
                <div className="flex items-center">
                  <CheckCircle className={`h-4 w-4 mr-2 ${application.consentFormCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                  Consent Form
                </div>
                <div className="flex items-center">
                  <CheckCircle className={`h-4 w-4 mr-2 ${application.supportingDocsCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                  Supporting Documents
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agricultural" className="space-y-4">
          {agriculturalReturn ? (
            <div className="space-y-4">
              <h4 className="font-semibold">Agricultural Return Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Application ID:</strong> {agriculturalReturn.applicationId}</div>
                <div><strong>Template ID:</strong> {agriculturalReturn.templateId}</div>
                <div><strong>Status:</strong> {agriculturalReturn.isComplete ? 'Complete' : 'Incomplete'}</div>
                <div><strong>Submitted:</strong> {agriculturalReturn.submittedAt ? new Date(agriculturalReturn.submittedAt).toLocaleDateString() : 'Draft'}</div>
                <div><strong>Created:</strong> {agriculturalReturn.createdAt ? new Date(agriculturalReturn.createdAt).toLocaleDateString() : 'Not available'}</div>
                <div><strong>Updated:</strong> {agriculturalReturn.updatedAt ? new Date(agriculturalReturn.updatedAt).toLocaleDateString() : 'Not available'}</div>
              </div>
              <div>
                <h5 className="font-medium">Form Responses:</h5>
                <div className="mt-2 space-y-2">
                  {agriculturalReturn.responses && typeof agriculturalReturn.responses === 'object' ? (
                    Object.entries(agriculturalReturn.responses).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium capitalize">{key.replace(/-/g, ' ')}:</span>
                        <span className="text-gray-700 dark:text-gray-300">{value as string}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No response data available</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No agricultural return data available</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <h4 className="font-semibold">Uploaded Documents</h4>
          {documents && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc: Document) => (
                <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{doc.fileName}</div>
                    <div className="text-sm text-gray-500">
                      {doc.documentType} • {Math.round(doc.fileSize / 1024)} KB
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No documents uploaded</p>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div>
            <h4 className="font-semibold mb-4">Update Application Status</h4>
            <div className="space-y-4">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => onStatusUpdate(newStatus)}
                disabled={newStatus === application.status}
                className="w-full"
              >
                Update Status
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}