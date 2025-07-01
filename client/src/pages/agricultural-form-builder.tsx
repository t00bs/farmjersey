import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Save, Eye, GripVertical, FileText, Settings } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

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

interface AgriculturalForm {
  id?: number;
  title: string;
  description: string;
  year: number;
  sections: FormSection[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_FORM_SECTIONS: FormSection[] = [
  {
    id: "section-a",
    title: "Landowner / Occupier Details",
    description: "Please update below if details supplied are incorrect",
    order: 1,
    fields: [
      {
        id: "full-name",
        type: "text",
        label: "Full Name",
        required: true
      },
      {
        id: "address-line-1",
        type: "text",
        label: "Address Line 1",
        required: true
      },
      {
        id: "address-line-2",
        type: "text",
        label: "Address Line 2",
        required: false
      },
      {
        id: "parish",
        type: "text",
        label: "Parish",
        required: true
      },
      {
        id: "postcode",
        type: "text",
        label: "Postcode",
        required: true
      },
      {
        id: "email",
        type: "text",
        label: "Email Address",
        required: true,
        validation: {
          pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
        }
      }
    ]
  },
  {
    id: "section-b",
    title: "Farm Workers, Accommodation and Facilities",
    description: "Please provide details of the maximum number in each category during the year",
    order: 2,
    fields: [
      {
        id: "owned-accommodation-units",
        type: "number",
        label: "How many units of staff accommodation do you own?",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "owned-bed-spaces",
        type: "number",
        label: "How many total bed spaces are provided within the owned units?",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "rented-accommodation-units",
        type: "number",
        label: "How many units of staff accommodation do you rent for your staff?",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "rented-bed-spaces",
        type: "number",
        label: "How many total bed spaces are provided within the rented units?",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "pesticide-stores",
        type: "number",
        label: "Pesticide and Chemical Store - Number of stores",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "slurry-stores",
        type: "number",
        label: "Slurry Storage - Number of stores",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "slurry-capacity",
        type: "number",
        label: "Slurry Storage - Total Capacity (litres)",
        required: false,
        validation: { min: 0 }
      }
    ]
  },
  {
    id: "section-c",
    title: "Land and Crops",
    description: "All land occupiers must supply a list of fields farmed and the crops and primary land use",
    order: 3,
    fields: [
      {
        id: "land-declaration-notes",
        type: "textarea",
        label: "Land Declaration Notes",
        placeholder: "The land declaration should be emailed as a spreadsheet...",
        required: false
      }
    ]
  },
  {
    id: "section-d",
    title: "Farm Livestock",
    description: "Please advise the number of the following farm livestock that you own or keep",
    order: 4,
    fields: [
      {
        id: "pigs",
        type: "number",
        label: "Pigs (total 'finished' in 2024)",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "sheep",
        type: "number",
        label: "Sheep",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "goats",
        type: "number",
        label: "Goats",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "chickens",
        type: "number",
        label: "Chickens",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "other-fowl",
        type: "number",
        label: "Other Fowl",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "horses-owned",
        type: "number",
        label: "Horses Owned",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "horses-livery",
        type: "number",
        label: "Horses Livery",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "donkeys-mules",
        type: "number",
        label: "Donkeys / Mules",
        required: false,
        validation: { min: 0 }
      },
      {
        id: "other-livestock",
        type: "text",
        label: "Other (please specify)",
        required: false
      }
    ]
  },
  {
    id: "section-e",
    title: "Integrated Farm Management",
    description: "Please indicate where you have the following integrated farm management plans",
    order: 5,
    fields: [
      {
        id: "soil-management-plan",
        type: "checkbox",
        label: "Soil Management Plan",
        required: false
      },
      {
        id: "water-management-plan",
        type: "checkbox",
        label: "Water Management Plan",
        required: false
      },
      {
        id: "nutrient-management-plan",
        type: "checkbox",
        label: "Nutrient Management Plan",
        required: false
      },
      {
        id: "waste-management-plan",
        type: "checkbox",
        label: "Waste Management Plan",
        required: false
      },
      {
        id: "animal-health-plan",
        type: "checkbox",
        label: "Animal Health Plan",
        required: false
      },
      {
        id: "conservation-landscape-plan",
        type: "checkbox",
        label: "Conservation and Landscape Plan",
        required: false
      },
      {
        id: "energy-audit-plan",
        type: "checkbox",
        label: "Energy Audit and Plan",
        required: false
      },
      {
        id: "carbon-net-zero-plan",
        type: "checkbox",
        label: "Carbon Net Zero Plan",
        required: false
      },
      {
        id: "carbon-net-zero-data",
        type: "checkbox",
        label: "Carbon Net Zero Data Collection",
        required: false
      },
      {
        id: "woodland-management-plan",
        type: "checkbox",
        label: "Woodland Management Plan",
        required: false
      },
      {
        id: "animal-welfare-vet-scheme",
        type: "checkbox",
        label: "Animal Welfare Vet Scheme",
        required: false
      },
      {
        id: "health-safety-plan",
        type: "checkbox",
        label: "Health and Safety Plan",
        required: false
      }
    ]
  }
];

export default function AgriculturalFormBuilder() {
  const { toast } = useToast();
  const [currentForm, setCurrentForm] = useState<AgriculturalForm>({
    title: "Agricultural Return 2025",
    description: "Annual agricultural return form",
    year: 2025,
    sections: DEFAULT_FORM_SECTIONS,
    isActive: false
  });
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { data: existingForms = [] } = useQuery({
    queryKey: ["/api/admin/agricultural-forms"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/agricultural-forms");
        if (!response.ok) return [];
        return await response.json();
      } catch {
        return [];
      }
    },
  });

  const saveFormMutation = useMutation({
    mutationFn: async (form: AgriculturalForm) => {
      console.log("Saving form with data:", form);
      const response = await apiRequest("POST", "/api/admin/agricultural-forms", form);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agricultural-forms"] });
      toast({
        title: "Form Saved",
        description: "Agricultural form has been saved successfully.",
      });
    },
    onError: (error) => {
      console.error("Error saving form:", error);
      toast({
        title: "Error",
        description: `Failed to save agricultural form: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const addSection = () => {
    const newSection: FormSection = {
      id: `section-${Date.now()}`,
      title: "New Section",
      description: "",
      order: currentForm.sections.length + 1,
      fields: []
    };
    setCurrentForm(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setEditingSection(newSection);
  };

  const updateSection = (sectionId: string, updates: Partial<FormSection>) => {
    setCurrentForm(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    }));
  };

  const deleteSection = (sectionId: string) => {
    setCurrentForm(prev => ({
      ...prev,
      sections: prev.sections.filter(section => section.id !== sectionId)
    }));
  };

  const addField = (sectionId: string) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type: "text",
      label: "New Field",
      required: false
    };
    
    updateSection(sectionId, {
      fields: [
        ...currentForm.sections.find(s => s.id === sectionId)?.fields || [],
        newField
      ]
    });
    setEditingField(newField);
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<FormField>) => {
    const section = currentForm.sections.find(s => s.id === sectionId);
    if (!section) return;

    const updatedFields = section.fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    updateSection(sectionId, { fields: updatedFields });
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    const section = currentForm.sections.find(s => s.id === sectionId);
    if (!section) return;

    const updatedFields = section.fields.filter(field => field.id !== fieldId);
    updateSection(sectionId, { fields: updatedFields });
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(currentForm.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order numbers
    const reorderedSections = items.map((section, index) => ({
      ...section,
      order: index + 1
    }));

    setCurrentForm(prev => ({
      ...prev,
      sections: reorderedSections
    }));
  };

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            placeholder={field.placeholder}
            disabled
            className="bg-gray-50"
          />
        );
      case "number":
        return (
          <Input
            type="number"
            placeholder={field.placeholder}
            disabled
            className="bg-gray-50"
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );
      case "select":
        return (
          <Select disabled>
            <SelectTrigger className="bg-gray-50">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <input type="checkbox" disabled className="h-4 w-4" />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "date":
        return (
          <Input
            type="date"
            disabled
            className="bg-gray-50"
          />
        );
      default:
        return (
          <Input
            type="text"
            placeholder={field.placeholder}
            disabled
            className="bg-gray-50"
          />
        );
    }
  };

  if (isPreviewMode) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {currentForm.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {currentForm.description}
            </p>
          </div>
          <Button onClick={() => setIsPreviewMode(false)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Form
          </Button>
        </div>

        <div className="space-y-6">
          {currentForm.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {section.fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label className="font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {renderFieldPreview(field)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agricultural Form Builder
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Create and edit agricultural return forms
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPreviewMode(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={() => saveFormMutation.mutate(currentForm)}>
            <Save className="h-4 w-4 mr-2" />
            Save Form
          </Button>
        </div>
      </div>

      <Tabs defaultValue="form-builder" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form-builder">Form Builder</TabsTrigger>
          <TabsTrigger value="existing-forms">Existing Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="form-builder" className="space-y-6">
          {/* Form Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Form Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="form-title">Form Title</Label>
                <Input
                  id="form-title"
                  value={currentForm.title}
                  onChange={(e) => setCurrentForm(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="form-year">Year</Label>
                <Input
                  id="form-year"
                  type="number"
                  value={currentForm.year}
                  onChange={(e) => setCurrentForm(prev => ({
                    ...prev,
                    year: parseInt(e.target.value)
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="form-description">Description</Label>
                <Input
                  id="form-description"
                  value={currentForm.description}
                  onChange={(e) => setCurrentForm(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Sections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Form Sections</CardTitle>
                <Button onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="sections">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                      {currentForm.sections
                        .sort((a, b) => a.order - b.order)
                        .map((section, index) => (
                          <Draggable key={section.id} draggableId={section.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="border rounded-lg p-4 bg-white dark:bg-gray-800"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <div {...provided.dragHandleProps}>
                                      <GripVertical className="h-4 w-4 text-gray-500" />
                                    </div>
                                    <h3 className="font-semibold">{section.title}</h3>
                                    <Badge variant="outline">{section.fields.length} fields</Badge>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingSection(section)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addField(section.id)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteSection(section.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {section.description && (
                                  <p className="text-sm text-gray-600 mb-4">{section.description}</p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {section.fields.map((field) => (
                                    <div key={field.id} className="border border-gray-200 rounded p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">{field.label}</span>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingField(field)}
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteField(section.id, field.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Badge variant="secondary">{field.type}</Badge>
                                        {field.required && <Badge variant="destructive">Required</Badge>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="existing-forms">
          <Card>
            <CardHeader>
              <CardTitle>Existing Forms</CardTitle>
              <CardDescription>
                Manage existing agricultural return forms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {existingForms.length > 0 ? (
                <div className="space-y-4">
                  {existingForms.map((form: AgriculturalForm) => (
                    <div key={form.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{form.title}</h3>
                          <p className="text-sm text-gray-600">{form.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge>{form.year}</Badge>
                            <Badge variant={form.isActive ? "default" : "secondary"}>
                              {form.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setCurrentForm(form)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No existing forms found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Section Edit Dialog */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update the section title and description
            </DialogDescription>
          </DialogHeader>
          {editingSection && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="section-title">Section Title</Label>
                <Input
                  id="section-title"
                  value={editingSection.title}
                  onChange={(e) => setEditingSection(prev => prev ? {
                    ...prev,
                    title: e.target.value
                  } : null)}
                />
              </div>
              <div>
                <Label htmlFor="section-description">Description</Label>
                <Textarea
                  id="section-description"
                  value={editingSection.description || ""}
                  onChange={(e) => setEditingSection(prev => prev ? {
                    ...prev,
                    description: e.target.value
                  } : null)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingSection(null)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  if (editingSection) {
                    updateSection(editingSection.id, editingSection);
                    setEditingSection(null);
                  }
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Field Edit Dialog */}
      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>
              Configure the field properties
            </DialogDescription>
          </DialogHeader>
          {editingField && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div>
                  <Label htmlFor="field-label">Field Label</Label>
                  <Input
                    id="field-label"
                    value={editingField.label}
                    onChange={(e) => setEditingField(prev => prev ? {
                      ...prev,
                      label: e.target.value
                    } : null)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="field-type">Field Type</Label>
                  <Select
                    value={editingField.type}
                    onValueChange={(value) => setEditingField(prev => prev ? {
                      ...prev,
                      type: value as FormField["type"]
                    } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="radio">Radio</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="field-placeholder">Placeholder</Label>
                  <Input
                    id="field-placeholder"
                    value={editingField.placeholder || ""}
                    onChange={(e) => setEditingField(prev => prev ? {
                      ...prev,
                      placeholder: e.target.value
                    } : null)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="field-required"
                    checked={editingField.required}
                    onChange={(e) => setEditingField(prev => prev ? {
                      ...prev,
                      required: e.target.checked
                    } : null)}
                  />
                  <Label htmlFor="field-required">Required field</Label>
                </div>

                {(editingField.type === "select" || editingField.type === "radio") && (
                  <div>
                    <Label htmlFor="field-options">Options (one per line)</Label>
                    <Textarea
                      id="field-options"
                      value={editingField.options?.join("\n") || ""}
                      onChange={(e) => setEditingField(prev => prev ? {
                        ...prev,
                        options: e.target.value.split("\n").filter(opt => opt.trim())
                      } : null)}
                    />
                  </div>
                )}

                {editingField.type === "number" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="field-min">Minimum Value</Label>
                      <Input
                        id="field-min"
                        type="number"
                        value={editingField.validation?.min || ""}
                        onChange={(e) => setEditingField(prev => prev ? {
                          ...prev,
                          validation: {
                            ...prev.validation,
                            min: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        } : null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="field-max">Maximum Value</Label>
                      <Input
                        id="field-max"
                        type="number"
                        value={editingField.validation?.max || ""}
                        onChange={(e) => setEditingField(prev => prev ? {
                          ...prev,
                          validation: {
                            ...prev.validation,
                            max: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        } : null)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditingField(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    if (editingField) {
                      const sectionId = currentForm.sections.find(s => 
                        s.fields.some(f => f.id === editingField.id)
                      )?.id;
                      if (sectionId) {
                        updateField(sectionId, editingField.id, editingField);
                      }
                      setEditingField(null);
                    }
                  }}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}