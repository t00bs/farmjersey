import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Download, Signature, Upload, AlertCircle, AlertTriangle } from "lucide-react";

type SectionStatus = "not_started" | "in_progress" | "completed";

interface ApplicationSectionProps {
  title: string;
  description: string;
  status: SectionStatus;
  estimatedTime?: string;
  iconType?: "clock" | "download" | "signature" | "upload";
  requiresTemplate?: boolean;
  requiresSignature?: boolean;
  acceptedFormats?: string;
  disabled?: boolean;
  primaryAction: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  templateDownload?: {
    label: string;
    onClick: () => void;
  };
}

export default function ApplicationSection({
  title,
  description,
  status,
  estimatedTime,
  iconType = "clock",
  requiresTemplate = false,
  requiresSignature = false,
  acceptedFormats,
  disabled = false,
  primaryAction,
  secondaryAction,
  templateDownload,
}: ApplicationSectionProps) {
  const getIcon = () => {
    switch (iconType) {
      case "download":
        return <Download className="w-4 h-4" />;
      case "signature":
        return <Signature className="w-4 h-4" />;
      case "upload":
        return <Upload className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return (
          <div className="w-8 h-8 bg-success-custom/10 rounded-full flex items-center justify-center">
            <CheckCircle className="text-success-custom w-5 h-5" />
          </div>
        );
      case "in_progress":
        return (
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertCircle className="text-orange-600 w-5 h-5" />
          </div>
        );
      case "not_started":
      default:
        return (
          <div className="w-5 h-5 min-w-5 min-h-5 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          </div>
        );
    }
  };

  const getInfoText = () => {
    if (requiresTemplate) return "Excel template required";
    if (requiresSignature) return "Digital signature required";
    if (acceptedFormats) return acceptedFormats;
    return null;
  };

  const getPrimaryButtonClass = () => {
    switch (primaryAction.variant) {
      case "outline":
        return "w-full bg-white border-2 border-primary-custom text-primary-custom font-medium py-3 px-4 rounded-md hover:bg-primary-custom hover:text-white transition-colors";
      case "secondary":
        return "w-full bg-white border-2 border-secondary-custom text-secondary-custom font-medium py-3 px-4 rounded-md hover:bg-secondary-custom hover:text-white transition-colors";
      default:
        return "bg-primary-custom text-white font-medium py-3 px-4 rounded-md hover:bg-primary-custom/90 transition-colors";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {getStatusIcon()}
      </div>
      <div className="space-y-3">
        {getInfoText() && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            {requiresTemplate ? <AlertTriangle className="w-4 h-4 text-gray-400" /> : getIcon()}
            <span>{getInfoText()}</span>
          </div>
        )}
        
        {templateDownload && (
          <button
            onClick={templateDownload.onClick}
            className="flex items-center space-x-2 text-sm text-primary-custom hover:underline cursor-pointer"
            data-testid="button-download-template"
          >
            <Download className="w-4 h-4" />
            <span>{templateDownload.label}</span>
          </button>
        )}
        
        {secondaryAction ? (
          <div className="flex space-x-3">
            <Button
              onClick={primaryAction.onClick}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 flex-1 bg-primary-custom font-medium py-3 px-4 rounded-md hover:bg-primary-custom/90 transition-colors text-[#000000]"
              disabled={disabled}
            >
              {primaryAction.label}
            </Button>
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              className="flex-1 font-medium py-3 px-4"
              disabled={disabled}
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          </div>
        ) : (
          <Button
            onClick={primaryAction.onClick}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 bg-primary-custom font-medium py-3 px-4 rounded-md hover:bg-primary-custom/90 transition-colors text-[#000000]"
            disabled={disabled}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </Card>
  );
}
