import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  percentage: number;
  className?: string;
}

export default function ProgressIndicator({ percentage, className }: ProgressIndicatorProps) {
  return (
    <div className={cn("", className)}>
      <div className="text-sm text-gray-500 mb-1">Application Progress</div>
      <div className="flex items-center space-x-2">
        <div className="w-32 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary-custom h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <span className="text-sm font-medium text-primary-custom">{percentage}%</span>
      </div>
    </div>
  );
}
