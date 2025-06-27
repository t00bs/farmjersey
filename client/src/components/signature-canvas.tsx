import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SignatureCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: number;
}

export default function SignatureCanvas({
  open,
  onOpenChange,
  applicationId,
}: SignatureCanvasProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const signatureMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      return await apiRequest("POST", `/api/digital-signature/${applicationId}`, {
        signature: signatureData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", applicationId] });
      toast({
        title: "Success",
        description: "Digital signature saved successfully!",
      });
      onOpenChange(false);
      clearCanvas();
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
        title: "Error",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const signatureData = canvas.toDataURL();
      signatureMutation.mutate(signatureData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Digital Signature
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              Please sign below to provide your digital signature for the Declaration and Consent Form.
            </p>
            <p className="text-xs text-gray-500">
              Draw your signature using your mouse or touchscreen.
            </p>
          </div>

          <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full bg-white border border-gray-200 rounded cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
          
          <div className="flex justify-between">
            <Button 
              variant="outline"
              onClick={clearCanvas}
              disabled={!hasSignature || signatureMutation.isPending}
            >
              Clear
            </Button>
            
            <div className="flex space-x-3">
              <Button 
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={signatureMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                className="bg-secondary-custom hover:bg-secondary-custom/90"
                onClick={saveSignature}
                disabled={!hasSignature || signatureMutation.isPending}
              >
                {signatureMutation.isPending ? "Saving..." : "Save Signature"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
