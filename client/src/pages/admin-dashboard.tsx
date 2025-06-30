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
import { Eye, FileText, Calendar, User, AlertTriangle, CheckCircle } from "lucide-react";
import type { GrantApplication, AgriculturalReturn, Document } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<GrantApplication | null>(null);

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
      return await apiRequest(`/api/admin/applications/${id}/status`, "PATCH", { status });
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
    const variants = {
      draft: { variant: "secondary" as const, label: "Draft" },
      in_progress: { variant: "default" as const, label: "In Progress" },
      submitted: { variant: "outline" as const, label: "Submitted" },
      approved: { variant: "default" as const, label: "Approved" },
      rejected: { variant: "destructive" as const, label: "Rejected" },
    };
    
    const config = variants[status as keyof typeof variants] || variants.draft;
    
    if (status === "approved") {
      return (
        <Badge variant={config.variant} className="bg-green-500 hover:bg-green-600">
          {config.label}
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
    const stats = applications.reduce((acc: any, app: GrantApplication) => {
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
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Applications</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Applications</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application: GrantApplication) => (
                <TableRow key={application.id}>
                  <TableCell className="font-medium">#{application.id}</TableCell>
                  <TableCell>{application.userId}</TableCell>
                  <TableCell>{application.year}</TableCell>
                  <TableCell>{getStatusBadge(application.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Progress value={application.progressPercentage} className="w-16" />
                      <span className="text-sm text-muted-foreground">
                        {application.progressPercentage}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {application.submittedAt 
                      ? new Date(application.submittedAt).toLocaleDateString()
                      : "Not submitted"
                    }
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
                          <ApplicationReviewDialog
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
    </div>
  );
}

function ApplicationReviewDialog({ 
  application, 
  onStatusUpdate 
}: { 
  application: GrantApplication; 
  onStatusUpdate: (status: string) => void;
}) {
  const [newStatus, setNewStatus] = useState(application.status);

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/applications", application.id, "documents"],
  });

  const { data: agriculturalReturn } = useQuery<AgriculturalReturn | null>({
    queryKey: ["/api/applications", application.id, "agricultural-return"],
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
                <div><strong>Total Acres:</strong> {agriculturalReturn.totalAcres || 'Not specified'}</div>
                <div><strong>Application ID:</strong> {agriculturalReturn.applicationId}</div>
                <div><strong>Created:</strong> {agriculturalReturn.createdAt ? new Date(agriculturalReturn.createdAt).toLocaleDateString() : 'Not available'}</div>
                <div><strong>Updated:</strong> {agriculturalReturn.updatedAt ? new Date(agriculturalReturn.updatedAt).toLocaleDateString() : 'Not available'}</div>
              </div>
              {agriculturalReturn.cropData && (
                <div>
                  <strong>Crop Data:</strong>
                  <pre className="mt-1 text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                    {String(typeof agriculturalReturn.cropData === 'string' 
                      ? agriculturalReturn.cropData 
                      : JSON.stringify(agriculturalReturn.cropData, null, 2))}
                  </pre>
                </div>
              )}
              {agriculturalReturn.landUsage && (
                <div>
                  <strong>Land Usage:</strong>
                  <pre className="mt-1 text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                    {String(typeof agriculturalReturn.landUsage === 'string' 
                      ? agriculturalReturn.landUsage 
                      : JSON.stringify(agriculturalReturn.landUsage, null, 2))}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No agricultural return data available</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <h4 className="font-semibold">Uploaded Documents</h4>
          {Array.isArray(documents) && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc: Document) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
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