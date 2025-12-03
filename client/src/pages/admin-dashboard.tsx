import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Eye, FileText, Calendar, User, Users, AlertTriangle, CheckCircle, FormInput, Download, CalendarDays, Mail, Trash2, Loader2, Shield, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { GrantApplication, AgriculturalReturn, Document, ApplicationWithUserData, AgriculturalFormResponse, Invitation, User as UserType } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin dashboard.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [authLoading, isAdmin, setLocation, toast]);
  
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-custom" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return null;
  }

  return <AdminDashboardContent />;
}

interface PaginatedResponse {
  data: ApplicationWithUserData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function AdminDashboardContent() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithUserData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data: paginatedData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/admin/applications", { status: statusFilter, from: dateRange?.from?.toISOString(), to: dateRange?.to?.toISOString(), page: currentPage }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (dateRange?.from) {
        params.append("startDate", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append("endDate", dateRange.to.toISOString());
      }
      params.append("page", currentPage.toString());
      params.append("limit", pageSize.toString());
      
      const url = `/api/admin/applications?${params.toString()}`;
      
      const response = await apiRequest("GET", url);
      return await response.json();
    },
  });

  const applications = paginatedData?.data || [];
  const totalPages = paginatedData?.totalPages || 1;
  const totalCount = paginatedData?.total || 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateRange]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/applications/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/admin/applications');
        }
      });
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

            <Tabs defaultValue="applications" className="w-full">
              <TabsList>
                <TabsTrigger value="applications">Applications</TabsTrigger>
                <TabsTrigger value="invitations">Invitations</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="applications" className="space-y-6 mt-6">

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
                <CardDescription>Filter applications by status and date range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
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
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant="outline"
                          className="w-[300px] justify-start text-left font-normal"
                          data-testid="button-date-filter"
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Actions</label>
                    <div className="flex flex-wrap space-x-2 gap-y-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setStatusFilter("all");
                          setDateRange(undefined);
                        }}
                        data-testid="button-clear-filters"
                      >
                        Clear Filters
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const url = `/api/admin/applications/export/csv?${new URLSearchParams({
                            ...(statusFilter !== "all" && { status: statusFilter }),
                            ...(dateRange?.from && { startDate: dateRange.from.toISOString() }),
                            ...(dateRange?.to && { endDate: dateRange.to.toISOString() })
                          }).toString()}`;
                          window.open(url, '_blank');
                        }}
                        data-testid="button-download-csv"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const url = `/api/admin/applications/export/xlsx?${new URLSearchParams({
                            ...(statusFilter !== "all" && { status: statusFilter }),
                            ...(dateRange?.from && { startDate: dateRange.from.toISOString() }),
                            ...(dateRange?.to && { endDate: dateRange.to.toISOString() })
                          }).toString()}`;
                          window.open(url, '_blank');
                        }}
                        data-testid="button-download-xlsx"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        XLSX
                      </Button>
                    </div>
                  </div>
                </div>
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
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} applications
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <span className="text-sm px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
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
              </TabsContent>

              <TabsContent value="invitations" className="space-y-6 mt-6">
                <InvitationsTab />
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-6">
                <UsersTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

function InvitationsTab() {
  const { toast } = useToast();
  const [showInviteForm, setShowInviteForm] = useState(false);

  const invitationFormSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
  });

  const form = useForm<z.infer<typeof invitationFormSchema>>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/admin/invitations"],
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invitationFormSchema>) => {
      return await apiRequest("POST", "/api/admin/invitations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      toast({
        title: "Invitation Sent",
        description: "The invitation has been sent successfully.",
      });
      form.reset();
      setShowInviteForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/admin/invitations/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      toast({
        title: "Invitation Deleted",
        description: "The invitation has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invitation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof invitationFormSchema>) => {
    createInvitationMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Invitations</CardTitle>
              <CardDescription>
                Invite users to access the farm grant application system
              </CardDescription>
            </div>
            <Button onClick={() => setShowInviteForm(!showInviteForm)} data-testid="button-new-invitation">
              <Mail className="h-4 w-4 mr-2" />
              New Invitation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showInviteForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <h3 className="text-lg font-semibold mb-4">Send New Invitation</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="user@example.com" 
                            {...field}
                            data-testid="input-invitation-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      disabled={createInvitationMutation.isPending}
                      data-testid="button-send-invitation"
                    >
                      {createInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowInviteForm(false)}
                      data-testid="button-cancel-invitation"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-400">
                    No invitations found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <TableRow key={invitation.id} data-testid={`row-invitation-${invitation.id}`}>
                    <TableCell className="font-medium" data-testid={`text-email-${invitation.id}`}>
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      {invitation.used ? (
                        <Badge variant="default" data-testid={`badge-used-${invitation.id}`}>Used</Badge>
                      ) : invitation.expiresAt && new Date() > new Date(invitation.expiresAt) ? (
                        <Badge variant="destructive" data-testid={`badge-expired-${invitation.id}`}>Expired</Badge>
                      ) : (
                        <Badge variant="outline" data-testid={`badge-pending-${invitation.id}`}>Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-created-${invitation.id}`}>
                      {invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`text-expires-${invitation.id}`}>
                      {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                        disabled={deleteInvitationMutation.isPending}
                        data-testid={`button-delete-${invitation.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'admin' | 'user' }) => {
      return await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleRoleToggle = (user: UserType) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    updateRoleMutation.mutate({ id: user.id, role: newRole });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage user roles and permissions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-400">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${user.id}`}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.email?.split('@')[0] || 'Unknown User'
                        }
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-email-${user.id}`}>
                      {user.email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {user.role === 'admin' ? (
                        <Badge variant="default" className="bg-amber-600" data-testid={`badge-admin-${user.id}`}>
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-user-${user.id}`}>
                          User
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-joined-${user.id}`}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {currentUser?.id === user.id ? (
                        <span className="text-sm text-gray-500 italic">Current user</span>
                      ) : (
                        <Button
                          variant={user.role === 'admin' ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleRoleToggle(user)}
                          disabled={updateRoleMutation.isPending}
                          data-testid={`button-toggle-role-${user.id}`}
                        >
                          {user.role === 'admin' ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-1" />
                              Demote
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" />
                              Promote
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
    queryKey: [`/api/admin/applications/${application.id}/documents`],
  });

  const { data: agriculturalReturn } = useQuery<AgriculturalFormResponse | null>({
    queryKey: [`/api/admin/applications/${application.id}/agricultural-response`],
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/api/documents/view/${doc.id}`, '_blank')}
                    data-testid={`button-view-document-${doc.id}`}
                  >
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