import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, CheckCircle } from "lucide-react";
import type { AgriculturalFormTemplate } from "@shared/schema";

interface AgriculturalReturnFormProps {
  applicationId: number;
  onComplete: () => void;
}

interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "radio" | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: FormField[];
}

export default function AgriculturalReturnForm({ applicationId, onComplete }: AgriculturalReturnFormProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<AgriculturalFormTemplate | null>(null);
  const [existingResponse, setExistingResponse] = useState<any>(null);

  // Fetch available form templates
  const { data: templates, isLoading: templatesLoading } = useQuery<AgriculturalFormTemplate[]>({
    queryKey: ["/api/agricultural-forms/templates"],
    retry: false,
  });

  const form = useForm<Record<string, any>>({
    defaultValues: {},
  });

  // Fetch existing response if template is selected
  const { data: responseData, isLoading: responseLoading } = useQuery({
    queryKey: ["/api/agricultural-forms", selectedTemplate?.id, "response", applicationId],
    queryFn: async () => {
      if (!selectedTemplate) return null;
      try {
        const response = await fetch(`/api/agricultural-forms/${selectedTemplate.id}/response/${applicationId}`);
        if (response.status === 404) {
          return null; // No existing response
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      } catch (error) {
        console.log("No existing response found:", error);
        return null;
      }
    },
    enabled: !!selectedTemplate,
    retry: false,
  });

  // Get template (most recent one, preferring active ones)
  useEffect(() => {
    if (templates && templates.length > 0) {
      const activeTemplate = templates
        .filter(t => t.isActive)
        .sort((a, b) => b.year - a.year)[0];
      
      if (activeTemplate) {
        setSelectedTemplate(activeTemplate);
      } else {
        // If no active template, use the most recent one
        const mostRecentTemplate = templates
          .sort((a, b) => b.year - a.year)[0];
        setSelectedTemplate(mostRecentTemplate);
      }
    }
  }, [templates]);

  // Set existing response and populate form
  useEffect(() => {
    if (responseData && typeof responseData === 'object' && 'responses' in responseData) {
      console.log("Found existing response:", responseData);
      setExistingResponse(responseData);
      // Populate form with existing data
      if ((responseData as any).responses) {
        form.reset((responseData as any).responses);
      }
    } else {
      console.log("No existing response found, clearing state");
      setExistingResponse(null);
    }
  }, [responseData, form]);

  // Clear existing response when template changes
  useEffect(() => {
    setExistingResponse(null);
  }, [selectedTemplate]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (existingResponse) {
        // Update existing response
        const payload = {
          responses: data,
          isComplete: true,
        };
        return await apiRequest("PUT", `/api/agricultural-forms/response/${existingResponse.id}`, payload);
      } else {
        // Create new response
        const payload = {
          templateId: selectedTemplate!.id,
          applicationId,
          responses: data,
          isComplete: true,
        };
        return await apiRequest("POST", "/api/agricultural-forms/response", payload);
      }
    },
    onSuccess: (data) => {
      console.log("Save successful:", data);
      // Update existing response state if this was a create operation
      if (!existingResponse && data) {
        setExistingResponse(data);
      }
      
      // Invalidate and refetch the query to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/agricultural-forms", selectedTemplate?.id, "response", applicationId]
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/grant-applications"]
      });
      
      toast({
        title: "Agricultural Return Saved",
        description: "Your agricultural return form has been saved successfully.",
      });
      
      if (onComplete) {
        onComplete();
      }
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
        description: "Failed to save agricultural return form. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case "text":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={field.placeholder}
                    {...formField}
                    value={formField.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "number":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={field.placeholder}
                    {...formField}
                    value={formField.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "textarea":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={field.placeholder}
                    {...formField}
                    value={formField.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "select":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <Select value={formField.value || ""} onValueChange={formField.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder || "Select an option"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "checkbox":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={formField.value || false}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{field.label}</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "radio":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={formField.value || ""}
                    onValueChange={formField.onChange}
                    className="flex flex-col space-y-1"
                  >
                    {field.options?.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                        <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "date":
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...formField}
                    value={formField.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      default:
        return null;
    }
  };

  if (templatesLoading || responseLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading form...
        </CardContent>
      </Card>
    );
  }

  if (!selectedTemplate) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">
            No agricultural return form template is currently available. Please contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sections = selectedTemplate.sections as FormSection[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Agricultural Return Form - {selectedTemplate.year}
        </CardTitle>
        <CardDescription>
          {selectedTemplate.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {sections
              .sort((a: FormSection, b: FormSection) => a.order - b.order)
              .map((section: FormSection) => (
                <div key={section.id} className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {section.title}
                    </h3>
                    {section.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {section.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.map(renderField)}
                  </div>
                  
                  <Separator />
                </div>
              ))}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="min-w-32"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Form
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}