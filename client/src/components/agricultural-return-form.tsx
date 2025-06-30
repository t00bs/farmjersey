import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, CheckCircle } from "lucide-react";
import type { AgriculturalFormTemplate, AgriculturalFormResponse } from "@shared/schema";

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
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
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
  const [formSchema, setFormSchema] = useState<z.ZodObject<any> | null>(null);

  // Fetch available form templates
  const { data: templates, isLoading: templatesLoading } = useQuery<AgriculturalFormTemplate[]>({
    queryKey: ["/api/admin/agricultural-forms"],
    retry: false,
  });

  // Get active template (most recent active one)
  useEffect(() => {
    if (templates && templates.length > 0) {
      const activeTemplate = templates
        .filter(t => t.isActive)
        .sort((a, b) => b.year - a.year)[0];
      
      if (activeTemplate) {
        setSelectedTemplate(activeTemplate);
        
        // Create dynamic form schema based on template
        const schemaFields: Record<string, any> = {};
        
        (activeTemplate.sections as FormSection[]).forEach((section: FormSection) => {
          section.fields.forEach((field: FormField) => {
            let fieldSchema;
            
            switch (field.type) {
              case "number":
                fieldSchema = z.number();
                if (field.validation?.min !== undefined) {
                  fieldSchema = fieldSchema.min(field.validation.min);
                }
                if (field.validation?.max !== undefined) {
                  fieldSchema = fieldSchema.max(field.validation.max);
                }
                break;
              case "checkbox":
                fieldSchema = z.boolean();
                break;
              default:
                fieldSchema = z.string();
                if (field.validation?.pattern) {
                  fieldSchema = fieldSchema.regex(new RegExp(field.validation.pattern));
                }
                break;
            }
            
            if (!field.required) {
              fieldSchema = fieldSchema.optional();
            }
            
            schemaFields[field.id] = fieldSchema;
          });
        });
        
        setFormSchema(z.object(schemaFields));
      }
    }
  }, [templates]);

  // Fetch existing response if any
  const { data: existingResponse } = useQuery<AgriculturalFormResponse>({
    queryKey: ["/api/agricultural-forms", selectedTemplate?.id, "response", applicationId],
    enabled: !!selectedTemplate?.id && !!applicationId,
    retry: false,
  });

  const form = useForm({
    resolver: formSchema ? zodResolver(formSchema) : undefined,
    defaultValues: existingResponse?.responses || {},
  });

  // Update form values when existing response is loaded
  useEffect(() => {
    if (existingResponse?.responses) {
      form.reset(existingResponse.responses as any);
    }
  }, [existingResponse, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        templateId: selectedTemplate!.id,
        applicationId,
        responses: data,
      };

      if (existingResponse) {
        return await apiRequest("PUT", `/api/agricultural-forms/response/${existingResponse.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/agricultural-forms/response", payload);
      }
    },
    onSuccess: () => {
      toast({
        title: "Agricultural Return Saved",
        description: "Your agricultural return form has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications", applicationId] });
      onComplete();
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

  if (templatesLoading) {
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

  if (!formSchema) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Preparing form...
        </CardContent>
      </Card>
    );
  }

  const renderField = (field: FormField) => {
    switch (field.type) {
      case "text":
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
                    type={field.type}
                    placeholder={field.placeholder}
                    {...formField}
                    value={formField.value || ""}
                    onChange={(e) => {
                      const value = field.type === "number" ? 
                        (e.target.value ? parseFloat(e.target.value) : "") : 
                        e.target.value;
                      formField.onChange(value);
                    }}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {existingResponse && <CheckCircle className="h-5 w-5 text-green-600" />}
          Agricultural Return Form - {selectedTemplate.year}
        </CardTitle>
        <CardDescription>
          {selectedTemplate.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {selectedTemplate.sections
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
                {existingResponse ? "Update Form" : "Save Form"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}