import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const consentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  farmCode: z.string().min(1, "Farm code is required"),
  email: z.string().email("Valid email is required"),
});

type ConsentFormData = z.infer<typeof consentFormSchema>;

interface ConsentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: number;
}

export default function ConsentFormModal({ open, onOpenChange, applicationId }: ConsentFormModalProps) {
  const { toast } = useToast();
  const [signature, setSignature] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPdfLoadError(false);
  }

  function onDocumentLoadError() {
    setPdfLoadError(true);
  }

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages || 1));

  const form = useForm<ConsentFormData>({
    resolver: zodResolver(consentFormSchema),
    defaultValues: {
      name: "",
      address: "",
      farmCode: "",
      email: "",
    },
  });

  const fillPdfMutation = useMutation({
    mutationFn: async (data: ConsentFormData & { signature?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/fill-consent-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    },
    onSuccess: (url) => {
      setPdfUrl(url);
      toast({
        title: "PDF Generated",
        description: "Your consent form has been filled. Review and download below.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async (data: { signature: string; name: string; address: string; farmCode: string; email: string }) => {
      return await apiRequest("POST", `/api/digital-signature/${applicationId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", applicationId] });
      toast({
        title: "Success",
        description: "Consent form completed successfully.",
      });
      onOpenChange(false);
    },
  });

  const handlePreview = form.handleSubmit((data) => {
    fillPdfMutation.mutate({
      ...data,
      signature: signature || undefined,
    });
  });

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = "RSS_Application_Filled.pdf";
      link.click();
    }
  };

  const handleComplete = form.handleSubmit((data) => {
    if (!signature) {
      toast({
        title: "Signature Required",
        description: "Please provide your signature before completing.",
        variant: "destructive",
      });
      return;
    }

    saveSignatureMutation.mutate({
      signature,
      name: data.name,
      address: data.address,
      farmCode: data.farmCode,
      email: data.email,
    });
  });

  // Canvas drawing functions with proper coordinate scaling
  const getScaledCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getScaledCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getScaledCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Declaration and Consent Form</DialogTitle>
          <DialogDescription>
            Complete this form to generate your RSS Application PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Declaration Preview</h3>
            <div className="border rounded bg-gray-50 dark:bg-gray-900" data-testid="pdf-preview-container">
              {pdfLoadError ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center p-4">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Unable to load PDF preview. The template will be filled with your details when you generate the PDF below.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => window.open("/api/download-template/rss-application", "_blank")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Document
                    file="/api/download-template/rss-application"
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <Page 
                      pageNumber={pageNumber} 
                      width={600}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </Document>
                  {numPages && numPages > 1 && (
                    <div className="flex items-center gap-4 py-3 border-t w-full justify-center bg-white dark:bg-gray-800">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {pageNumber} of {numPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={pageNumber >= numPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter your full name" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter your complete address (line by line)" 
                        rows={4}
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="farmCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farm Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter farm code" data-testid="input-farm-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Enter email address" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Signature</FormLabel>
                <Card className="p-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="border border-gray-300 rounded cursor-crosshair w-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    data-testid="canvas-signature"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSignature}
                    className="mt-2"
                    data-testid="button-clear-signature"
                  >
                    Clear Signature
                  </Button>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={fillPdfMutation.isPending}
                  data-testid="button-generate-pdf"
                >
                  {fillPdfMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate PDF
                    </>
                  )}
                </Button>

                {pdfUrl && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownload}
                      data-testid="button-download-pdf"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>

                    <Button
                      onClick={handleComplete}
                      disabled={saveSignatureMutation.isPending}
                      data-testid="button-complete-form"
                    >
                      {saveSignatureMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Complete Consent Form"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
