import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Image, FileSpreadsheet, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

interface DocumentDisplayProps {
  applicationId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DocumentDisplay({ applicationId, open, onOpenChange }: DocumentDisplayProps) {
  const { toast } = useToast();
  const [downloadingDoc, setDownloadingDoc] = useState<number | null>(null);

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents", applicationId],
    enabled: !!applicationId && open,
    retry: false,
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <Image className="w-5 h-5 text-blue-500" />;
    } else if (fileType.includes("pdf")) {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else if (fileType.includes("sheet") || fileType.includes("excel")) {
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    }
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case "land_declaration":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      case "supporting_doc":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  const getDocumentTypeName = (type: string) => {
    switch (type) {
      case "land_declaration":
        return "Land Declaration";
      case "supporting_doc":
        return "Supporting Document";
      default:
        return type.replace("_", " ").toUpperCase();
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      setDownloadingDoc(document.id);
      
      const response = await fetch(`/api/download-document/${document.id}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
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
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element and trigger download
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.fileName;
      window.document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: `Downloading ${document.fileName}`,
      });
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
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
      
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingDoc(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Uploaded Documents</DialogTitle>
              <DialogDescription>
                View and download your uploaded documents
              </DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              data-testid="button-close-documents"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <Skeleton className="w-10 h-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-3 w-[200px]" />
                  </div>
                  <Skeleton className="h-9 w-[100px]" />
                </div>
              ))}
            </div>
          ) : !documents || documents.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents Uploaded</h3>
                <p className="text-gray-600">
                  You haven't uploaded any documents yet. Use the upload button in the application sections to add documents.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <Card key={document.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {getFileIcon(document.fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="text-sm font-medium text-gray-900 truncate" title={document.fileName}>
                              {document.fileName}
                            </h4>
                            <Badge 
                              variant="secondary" 
                              className={getDocumentTypeColor(document.documentType)}
                            >
                              {getDocumentTypeName(document.documentType)}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatFileSize(document.fileSize)}</span>
                            <span>•</span>
                            <span>
                              Uploaded {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'Unknown date'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          disabled={downloadingDoc === document.id}
                          data-testid={`button-download-${document.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {downloadingDoc === document.id ? "Downloading..." : "Download"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}