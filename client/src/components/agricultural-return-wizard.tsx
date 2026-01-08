import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save, ChevronLeft, ChevronRight, Check, FileText } from "lucide-react";

interface AgriculturalReturnWizardProps {
  applicationId: number;
  onComplete: () => void;
  readOnly?: boolean;
}

const farmDetailsSchema = z.object({
  farmName: z.string().optional(),
  farmCode: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  parish: z.string().optional(),
  postcode: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().optional(),
});

const financialSchema = z.object({
  produceSalesExport: z.string().optional(),
  produceSalesLocal: z.string().optional(),
  servicesRental: z.string().optional(),
  grantsSupport: z.string().optional(),
  otherIncome: z.string().optional(),
  totalIncome: z.string().optional(),
  wagesSalaries: z.string().optional(),
  itis: z.string().optional(),
  socialSecurity: z.string().optional(),
  propertyRental: z.string().optional(),
  allOtherExpenses: z.string().optional(),
  tradingProfit: z.string().optional(),
});

const facilitiesSchema = z.object({
  pesticideStoreCount: z.string().optional(),
  pesticideStoreAddress: z.string().optional(),
  slurryStoreCount: z.string().optional(),
  slurryCapacityLitres: z.string().optional(),
});

const livestockSchema = z.object({
  pigs: z.string().optional(),
  sheep: z.string().optional(),
  goats: z.string().optional(),
  chickens: z.string().optional(),
  otherFowl: z.string().optional(),
  horsesOwned: z.string().optional(),
  horsesLivery: z.string().optional(),
  donkeysMules: z.string().optional(),
  other: z.string().optional(),
  otherSpecify: z.string().optional(),
});

const accreditationSchema = z.object({
  leafOption: z.string().optional(),
  organicOption: z.string().optional(),
  brcGlobal: z.boolean().default(false),
  globalGap: z.boolean().default(false),
  redTractor: z.boolean().default(false),
  salsa: z.boolean().default(false),
  kiwa: z.boolean().default(false),
  britishHorseSociety: z.boolean().default(false),
});

const managementPlansSchema = z.object({
  soilPlan: z.boolean().default(false),
  waterPlan: z.boolean().default(false),
  nutrientPlan: z.boolean().default(false),
  wastePlan: z.boolean().default(false),
  animalHealthPlan: z.boolean().default(false),
  conservationPlan: z.boolean().default(false),
  energyAudit: z.boolean().default(false),
  carbonNetZeroPlan: z.boolean().default(false),
  carbonDataCollection: z.boolean().default(false),
  woodlandPlan: z.boolean().default(false),
  dairyWelfareVet: z.boolean().default(false),
  healthSafetyPlan: z.boolean().default(false),
});

const tier3Schema = z.object({
  eatSafeStars: z.string().optional(),
  genuineJerseyMember: z.boolean().default(false),
  greatTasteProducts: z.string().optional(),
  farmOpenDays: z.string().optional(),
  publicFootpathsMeters: z.string().optional(),
  wildlifePonds: z.string().optional(),
  wasteRecyclingTonnes: z.string().optional(),
});

const declarationSchema = z.object({
  declarationName: z.string().min(1, "Full name is required"),
  declarationDate: z.string().min(1, "Date is required"),
});

const combinedSchema = z.object({
  farmDetails: farmDetailsSchema,
  accreditation: accreditationSchema,
  managementPlans: managementPlansSchema,
  facilities: facilitiesSchema,
  livestock: livestockSchema,
  tier3: tier3Schema,
  financial: financialSchema,
  declaration: declarationSchema,
});

type CombinedFormData = z.infer<typeof combinedSchema>;

const STEPS = [
  { id: "farmDetails", title: "Section A - Farm Details", description: "Update your farm name and contact information" },
  { id: "accreditation", title: "Section B - Accreditation", description: "LEAF, organic and other certifications" },
  { id: "management", title: "Section C - Integrated Farm Management", description: "Management plans and schemes" },
  { id: "facilities", title: "Section D - Land and Facilities", description: "Field list and storage facilities" },
  { id: "livestock", title: "Section E - Farm Livestock", description: "Number of livestock you own or keep" },
  { id: "tier3", title: "Section F - Tier 3", description: "Awards, accreditations and environmental contributions" },
  { id: "financial", title: "Section G - Financial Declaration", description: "Income and expenditure details for 2025" },
  { id: "declaration", title: "Section H - Declaration", description: "RSS Terms, Conditions and Declaration" },
];

export default function AgriculturalReturnWizard({ applicationId, onComplete, readOnly = false }: AgriculturalReturnWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getDefaultFormValues = (): CombinedFormData => ({
    farmDetails: {
      farmName: "",
      farmCode: "",
      addressLine1: "",
      addressLine2: "",
      parish: "",
      postcode: "",
      telephone: "",
      email: "",
    },
    accreditation: {
      leafOption: "",
      organicOption: "",
      brcGlobal: false,
      globalGap: false,
      redTractor: false,
      salsa: false,
      kiwa: false,
      britishHorseSociety: false,
    },
    managementPlans: {
      soilPlan: false,
      waterPlan: false,
      nutrientPlan: false,
      wastePlan: false,
      animalHealthPlan: false,
      conservationPlan: false,
      energyAudit: false,
      carbonNetZeroPlan: false,
      carbonDataCollection: false,
      woodlandPlan: false,
      dairyWelfareVet: false,
      healthSafetyPlan: false,
    },
    facilities: {
      pesticideStoreCount: "",
      pesticideStoreAddress: "",
      slurryStoreCount: "",
      slurryCapacityLitres: "",
    },
    livestock: {
      pigs: "",
      sheep: "",
      goats: "",
      chickens: "",
      otherFowl: "",
      horsesOwned: "",
      horsesLivery: "",
      donkeysMules: "",
      other: "",
      otherSpecify: "",
    },
    tier3: {
      eatSafeStars: "",
      genuineJerseyMember: false,
      greatTasteProducts: "",
      farmOpenDays: "",
      publicFootpathsMeters: "",
      wildlifePonds: "",
      wasteRecyclingTonnes: "",
    },
    financial: {
      produceSalesExport: "",
      produceSalesLocal: "",
      servicesRental: "",
      grantsSupport: "",
      otherIncome: "",
      totalIncome: "",
      wagesSalaries: "",
      itis: "",
      socialSecurity: "",
      propertyRental: "",
      allOtherExpenses: "",
      tradingProfit: "",
    },
    declaration: {
      declarationName: "",
      declarationDate: new Date().toISOString().split('T')[0],
    },
  });

  const form = useForm<CombinedFormData>({
    resolver: zodResolver(combinedSchema),
    defaultValues: getDefaultFormValues(),
  });

  const { data: existingReturn, isLoading: returnLoading } = useQuery({
    queryKey: ["/api/agricultural-returns", applicationId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/agricultural-returns/${applicationId}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      } catch (error) {
        console.log("No existing agricultural return found:", error);
        return null;
      }
    },
    retry: false,
  });

  useEffect(() => {
    if (existingReturn) {
      const defaults = getDefaultFormValues();
      
      // Merge existing data with defaults to ensure no undefined values
      const formData: CombinedFormData = {
        farmDetails: { ...defaults.farmDetails, ...(existingReturn.farmDetailsData || {}) },
        accreditation: { ...defaults.accreditation, ...(existingReturn.accreditationData || {}) },
        managementPlans: { ...defaults.managementPlans, ...(existingReturn.managementPlans || {}) },
        facilities: { ...defaults.facilities, ...(existingReturn.facilitiesData || {}) },
        livestock: { ...defaults.livestock, ...(existingReturn.livestockData || {}) },
        tier3: { ...defaults.tier3, ...(existingReturn.tier3Data || {}) },
        financial: { ...defaults.financial, ...(existingReturn.financialData || {}) },
        declaration: {
          declarationName: existingReturn.declarationName ?? "",
          declarationDate: existingReturn.declarationDate 
            ? new Date(existingReturn.declarationDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        },
      };
      form.reset(formData);
      
      if (existingReturn.declarationSignature) {
        setSignature(existingReturn.declarationSignature);
      }
    }
  }, [existingReturn, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CombinedFormData & { signature: string | null; isComplete: boolean }) => {
      const payload = {
        applicationId,
        farmDetailsData: data.farmDetails,
        accreditationData: data.accreditation,
        managementPlans: data.managementPlans,
        facilitiesData: data.facilities,
        livestockData: data.livestock,
        tier3Data: data.tier3,
        financialData: data.financial,
        declarationName: data.declaration.declarationName,
        declarationDate: data.declaration.declarationDate,
        declarationSignature: data.signature,
        isComplete: data.isComplete,
        completedSections: {
          farmDetails: true,
          accreditation: true,
          management: true,
          facilities: true,
          livestock: true,
          tier3: true,
          financial: true,
          declaration: data.isComplete,
        },
      };

      if (existingReturn?.id) {
        return await apiRequest("PUT", `/api/agricultural-returns/${existingReturn.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/agricultural-returns", payload);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agricultural-returns", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/grant-applications"] });
      
      if (variables.isComplete) {
        toast({
          title: "Agricultural Return Completed",
          description: "Your agricultural return has been saved and signed successfully.",
        });
        onComplete();
      } else {
        toast({
          title: "Progress Saved",
          description: "Your agricultural return progress has been saved.",
        });
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
        description: "Failed to save agricultural return. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveProgress = () => {
    const data = form.getValues();
    saveMutation.mutate({ ...data, signature, isComplete: false });
  };

  const handleComplete = () => {
    if (!signature) {
      toast({
        title: "Signature Required",
        description: "Please provide your signature before completing the form.",
        variant: "destructive",
      });
      return;
    }

    const data = form.getValues();
    if (!data.declaration.declarationName) {
      toast({
        title: "Name Required",
        description: "Please enter your full name before completing the form.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({ ...data, signature, isComplete: true });
  };

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
    if (readOnly) return;
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
    if (!isDrawing || readOnly) return;

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
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  useEffect(() => {
    if (signature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = signature;
      }
    }
  }, [signature, currentStep]);

  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  if (returnLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading form...
        </CardContent>
      </Card>
    );
  }

  const renderFarmDetailsSection = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Please verify and update your farm details if any information has changed.
      </p>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="farmDetails.farmName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Farm Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Enter your farm name" {...field} disabled={readOnly} data-testid="input-farm-name" />
                </FormControl>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="farmDetails.farmCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Farm Code</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Enter your farm code" {...field} disabled={readOnly} data-testid="input-farm-code" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="farmDetails.addressLine1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address Line 1</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Street address" {...field} disabled={readOnly} data-testid="input-address-line1" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="farmDetails.addressLine2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address Line 2</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Additional address (optional)" {...field} disabled={readOnly} data-testid="input-address-line2" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="farmDetails.parish"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parish</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Parish" {...field} disabled={readOnly} data-testid="input-parish" />
                </FormControl>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="farmDetails.postcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postcode</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="JE1 1AA" {...field} disabled={readOnly} data-testid="input-postcode" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="farmDetails.telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telephone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="01234 567890" {...field} disabled={readOnly} data-testid="input-telephone" />
                </FormControl>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="farmDetails.email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} disabled={readOnly} data-testid="input-email" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );

  const renderAccreditationSection = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Please indicate your farm's accreditation status. Select one option from LEAF membership (if applicable), 
        one option from organic certification (if applicable), and check any other certifications that apply.
      </p>
      
      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium">LEAF Accreditation (choose one if applicable)</h4>
          <FormField
            control={form.control}
            name="accreditation.leafOption"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormControl>
                  <div className="space-y-2">
                    {[
                      { value: "member", label: "LEAF Member" },
                      { value: "sustainable_farming_review", label: "LEAF Sustainable Farming Review" },
                      { value: "marque_certified", label: "LEAF Marque Certified" },
                      { value: "marque_demonstration_farm", label: "LEAF Marque Demonstration Farm" },
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-3">
                        <Checkbox
                          checked={field.value === option.value}
                          onCheckedChange={(checked) => field.onChange(checked ? option.value : "")}
                          disabled={readOnly}
                          data-testid={`checkbox-leaf-${option.value}`}
                        />
                        <label className="text-sm font-normal cursor-pointer">{option.label}</label>
                      </div>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <h4 className="font-medium">Organic Certification (choose one if applicable)</h4>
          <FormField
            control={form.control}
            name="accreditation.organicOption"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormControl>
                  <div className="space-y-2">
                    {[
                      { value: "member_organic_association", label: "Member of an Organic Association" },
                      { value: "in_conversion", label: "Organic 'In Conversion'" },
                      { value: "organic_certified", label: "Organic Certified" },
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-3">
                        <Checkbox
                          checked={field.value === option.value}
                          onCheckedChange={(checked) => field.onChange(checked ? option.value : "")}
                          disabled={readOnly}
                          data-testid={`checkbox-organic-${option.value}`}
                        />
                        <label className="text-sm font-normal cursor-pointer">{option.label}</label>
                      </div>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <h4 className="font-medium">Other Certifications (select all that apply)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "accreditation.brcGlobal" as const, label: "BRC Global Standard" },
              { name: "accreditation.globalGap" as const, label: "Global GAP" },
              { name: "accreditation.redTractor" as const, label: "Red Tractor" },
              { name: "accreditation.salsa" as const, label: "SALSA" },
              { name: "accreditation.kiwa" as const, label: "KIWA" },
              { name: "accreditation.britishHorseSociety" as const, label: "British Horse Society" },
            ].map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={readOnly}
                        data-testid={`checkbox-${item.name.replace('accreditation.', '')}`}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">{item.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinancialSection = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        A Financial Return for 2025 to be completed by a qualified accountant must be returned by 11th September 2026. 
        If not available, use management accounts and provide estimates.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium">Income</h4>
          <FormField
            control={form.control}
            name="financial.produceSalesExport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produce Sales (Export)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-produce-sales-export" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.produceSalesLocal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produce Sales (Local)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-produce-sales-local" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.servicesRental"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Services and Rental</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-services-rental" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.grantsSupport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grants/Support</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-grants-support" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.otherIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Other Income</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-other-income" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.totalIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Income</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-total-income" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium">Expenditure</h4>
          <FormField
            control={form.control}
            name="financial.wagesSalaries"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Wages and Salaries</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-wages-salaries" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.itis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ITIS</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-itis" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.socialSecurity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Social Security</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-social-security" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.propertyRental"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Rental</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-property-rental" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.allOtherExpenses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>All Other Expenses</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-all-other-expenses" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financial.tradingProfit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trading Profit (Loss)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="£" {...field} disabled={readOnly} data-testid="input-trading-profit" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );

  const renderFacilitiesSection = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All land occupiers must supply a list of fields farmed with crops and details on people employed on the Agricultural Return spreadsheet.
      </p>
      
      <div className="space-y-4">
        <h4 className="font-medium">Pesticide and Chemical Store</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="facilities.pesticideStoreCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of stores</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-pesticide-store-count" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="facilities.pesticideStoreAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address (if different from main)</FormLabel>
                <FormControl>
                  <Input placeholder="Address" {...field} disabled={readOnly} data-testid="input-pesticide-store-address" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h4 className="font-medium">Slurry Storage</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="facilities.slurryStoreCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of stores</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-slurry-store-count" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="facilities.slurryCapacityLitres"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Capacity (litres)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-slurry-capacity" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );

  const renderLivestockSection = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Please advise the number of the following farm livestock that you own or keep. 
        (Cattle numbers are provided by the RJA and HS - no need to complete here). 
        (PIGS - total sows and 'finished' in 2025)
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="livestock.pigs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pigs</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-pigs" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.sheep"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sheep</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-sheep" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.goats"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goats</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-goats" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.chickens"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chickens</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-chickens" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.otherFowl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Fowl</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-other-fowl" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.horsesOwned"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horses Owned</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-horses-owned" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.horsesLivery"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horses Livery</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-horses-livery" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.donkeysMules"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Donkeys / Mules</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-donkeys-mules" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="livestock.other"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-other-livestock" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="livestock.otherSpecify"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Other (please specify)</FormLabel>
            <FormControl>
              <Textarea placeholder="Describe other livestock..." {...field} disabled={readOnly} data-testid="input-other-specify" />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );

  const renderManagementSection = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Please indicate where you have the following integrated farm management plans and acknowledge 
        adherence to the contents of such plans.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: "managementPlans.soilPlan" as const, label: "Soil Management Plan" },
          { name: "managementPlans.waterPlan" as const, label: "Water Management Plan" },
          { name: "managementPlans.nutrientPlan" as const, label: "Nutrient Management Plan" },
          { name: "managementPlans.wastePlan" as const, label: "Waste Management Plan" },
          { name: "managementPlans.animalHealthPlan" as const, label: "Animal Health Plan" },
          { name: "managementPlans.conservationPlan" as const, label: "Conservation and Landscape Plan" },
          { name: "managementPlans.energyAudit" as const, label: "Energy Audit and Plan" },
          { name: "managementPlans.carbonNetZeroPlan" as const, label: "Carbon Net Zero Plan" },
          { name: "managementPlans.carbonDataCollection" as const, label: "Carbon Net Zero Data Collection" },
          { name: "managementPlans.woodlandPlan" as const, label: "Woodland Management Plan" },
          { name: "managementPlans.dairyWelfareVet" as const, label: "Dairy Welfare Vet Scheme" },
          { name: "managementPlans.healthSafetyPlan" as const, label: "Health and Safety Plan" },
        ].map((item) => (
          <FormField
            key={item.name}
            control={form.control}
            name={item.name}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={readOnly}
                    data-testid={`checkbox-${item.name.replace('managementPlans.', '')}`}
                  />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">{item.label}</FormLabel>
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );

  const renderTier3Section = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Awards, accreditations, and environmental contributions.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="tier3.eatSafeStars"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Eat Safe Jersey (Number of Stars)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0-5" min="0" max="5" {...field} disabled={readOnly} data-testid="input-eat-safe-stars" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tier3.genuineJerseyMember"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={readOnly}
                  data-testid="checkbox-genuine-jersey"
                />
              </FormControl>
              <FormLabel className="font-normal cursor-pointer">Genuine Jersey Member</FormLabel>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tier3.greatTasteProducts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Great Taste Awards (Product and number of stars)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Butter (2 stars)" {...field} disabled={readOnly} data-testid="input-great-taste" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tier3.farmOpenDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of Farm Open Days in 2025</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-farm-open-days" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tier3.publicFootpathsMeters"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maintained Public Footpaths (meters)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-public-footpaths" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tier3.wildlifePonds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of Wildlife Ponds</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-wildlife-ponds" />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tier3.wasteRecyclingTonnes"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Waste Recycling (plastic/oil/packaging - tonnes recycled)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={readOnly} data-testid="input-waste-recycling" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderDeclarationSection = () => (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/50">
        <h4 className="font-semibold mb-3 text-lg">RSS Declaration and Consent</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Before signing this form please read the declaration notes and consent information carefully. The notes set out your agreement and understanding of the conditions required under the RSS. The consent information explains how your information will be used and provides a brief description of your rights under the Data Protection (Jersey) Law 2018. For further information on how the Government of Jersey handles personal data please visit <a href="https://www.gov.je/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.gov.je/privacy</a>
        </p>
        
        <div className="border-t pt-4 mt-4">
          <h5 className="font-semibold mb-3">Important Information</h5>
          <p className="text-sm font-medium mb-3">Declaration Notes re Agricultural Return for the Rural Support Scheme</p>
          <p className="text-sm text-muted-foreground mb-3">This confirms on behalf of the business that I:</p>
          
          <div className="text-sm space-y-3 text-muted-foreground max-h-64 overflow-y-auto pr-2">
            <p><strong>1.</strong> Agree to provide 2025 signed accounts if grants or subsidies received from the Government of Jersey exceed £75,000. Agree to provide a Financial Declaration Form if grants or subsidies received from the Government of Jersey are less than £74,999.</p>
            
            <p><strong>2.</strong> Understand that this information may be used in whole or part for the purpose of producing aggregated information that may be used or subsequently published by the Government of Jersey.</p>
            
            <p><strong>3.</strong> Agree to provide signed audited accounts or a Financial Declaration Form for the payment received in 2026 should I not claim RSS in 2027.</p>
            
            <p><strong>4.</strong> Agree to include the receipt of all government grants as income in the annual accounts of the business it was intended to support.</p>
            
            <p><strong>5.</strong> Understand and accept that the Comptroller and Auditor General (CAG) may audit any Government funded individual or organisation where the grant received is greater than £5,000.</p>
            
            <p><strong>6.</strong> Understand and accept that the Comptroller and Auditor General (CAG) may audit any Government funded individual or organisation where the grant is less than £5,000 but represents at least 50% of the total amount/income received during that year.</p>
            
            <p><strong>7.</strong> Agree to Officers from the relevant departments accessing information held about my business by assurance providers including but not limited to LEAF, Red Tractor, Acoura, NSF, SAI Global, SALSA, KIWA, BHS, BRC Global.</p>
            
            <p><strong>8.</strong> Understand I may also be required to demonstrate that I have robust corporate governance arrangements in place that ensure the future viability of my business.</p>
            
            <p><strong>9.</strong> Understand that failure to submit all documents in accordance with the deadlines given will result in my application not being processed.</p>
            
            <p><strong>10.</strong> Understand that, if in receipt of an agricultural loan in arrears, any payments due to me may be withheld to offset arrears.</p>
            
            <p><strong>11.</strong> Agree to provide for inspection by Officers from relevant departments (within 24 hour notice) my implemented Water Pollution Contingency Plan, Soil Protection Plan, Pesticide Application Records, Crop Nutrient Management Plan, Waste Management Plan and Disposal Record, Farm Manure and Organic Waste Management Plan:</p>
            
            <div className="pl-4 space-y-2">
              <p><strong>a)</strong> Waste Management Plan and Disposal Record: a current Waste Disposal Record showing the date, amount and disposal route of all wastes emanating from the farm. An undertaking to dispose of all farm waste materials in an approved way within the current year, pay any relevant disposal charge and keep appropriate records.</p>
              
              <p><strong>b)</strong> Farm Manure and Organic Waste Management Plan: if I keep livestock, import organic manures, sewage sludge or compost, or allow others to apply these to the land on which I claim then I need to have a current plan in place.</p>
              
              <p><strong>c)</strong> Pesticide Application Records: keep records of the date and amount of any application of pesticides applied in fields claimed for. To have evidence of using suitably qualified advice prior to application of pesticides.</p>
              
              <p><strong>d)</strong> Water Pollution Contingency Plan: this is for the farm premises and will include: a map of watercourses on the farm and drainage systems, fuel and oil facilities, fertilizer usage and storage areas, pesticide usage and storage areas, and details of management procedures and equipment in place to minimize the risk of pollution.</p>
            </div>
            
            <p><strong>12.</strong> Understand and will abide by the conditions set out in all sections of this RSS document.</p>
            
            <p><strong>13.</strong> Understand that the submission of false or misleading information will lead to penalties being imposed against me and may require full/or part repayment of any RSS payment, and that suspected fraudulent activity will be reported to the police.</p>
            
            <p><strong>14.</strong> To abide by all relevant current Jersey legislation.</p>
            
            <p><strong>15.</strong> That a Children and Vulnerable Adults Safeguarding Policy must be implemented (see notes below re safeguarding).</p>
            
            <p><strong>16.</strong> To comply with Codes of Good Agricultural and Environmental Practice (GAEP):</p>
            <div className="pl-4 space-y-2">
              <p><strong>a)</strong> GAEP for the Welfare of livestock (cattle, sheep, goats, pigs, poultry, and horses) are guidelines which set minimum standards for environment, public health, animal and plant health, and animal welfare. Contravention of GAEP or the Welfare Codes will result in your RSS being reduced.</p>
              <p><strong>b)</strong> Please also refer to the DEFRA publication 'Protecting our Water, Soil and Air: A Code of Good Agricultural Practice for farmers, growers and land managers' (CoGAP), available at <a href="https://www.gov.uk" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.gov.uk</a></p>
            </div>
            
            <p><strong>17.</strong> To provide a list of fields occupied during the last calendar year with all crops grown for each field, together with a list of fields and crops intended for the current year, when I submit my RSS application as part of my Agricultural Return.</p>
            
            <p><strong>18.</strong> I declare that the Applicant Business is a going concern and is not in immediate danger of insolvency, winding up or ceasing to trade on a permanent basis.</p>
            
            <p><strong>19.</strong> I declare the Applicant Enterprise has filed all necessary tax and social security returns and paid all relevant taxes and social security contributions due to the Government up to date (allowing for deferrals where permitted by arrangement with Revenue Jersey).</p>
          </div>
        </div>
        
        <div className="border-t pt-4 mt-4">
          <h5 className="font-semibold mb-3">Safeguarding</h5>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>I hereby acknowledge that vulnerable people have a right to be safe and that adults have a responsibility to protect them. I hereby acknowledge and confirm that where our business has children and or vulnerable adults working on, living on (whether or not directly employed) or visiting our business premises (land and buildings), I have a direct responsibility in respect to the safeguarding of those individuals and I will take appropriate actions to ensure those responsibilities are met.</p>
            <p>I hereby acknowledge that where my organisation has any involvement with children and or vulnerable adults that I will implement appropriate safeguarding policies and procedures. I will ensure that my staff are appropriately vetted and trained in respect to safeguarding and that designated safeguarding lead(s) will be appointed.</p>
            <p>Guidance on safeguarding (including procedures and the reporting of concerns) can be found by visiting <a href="https://www.safeguarding.je" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.safeguarding.je</a> or by contacting the Safeguarding Partnership Board.</p>
          </div>
        </div>
        
        <div className="border-t pt-4 mt-4">
          <h5 className="font-semibold mb-3">Consent Information</h5>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p><strong>I confirm and agree:</strong></p>
            <ul className="list-disc pl-5 space-y-2">
              <li>That this declaration is made with my authority. I am aware that it's an offence to submit false or misleading information on a declaration.</li>
              <li>That the information supplied in this form, together with any other accompanying information, is to be used for the purpose(s) of collecting my annual returns in accordance with the Agricultural Returns (Jersey) Law 1947, Agricultural Returns (Amendment) (Jersey) Law 1958, and the Agriculture (Guaranteed Prices and Financial Assistance) (Jersey) Law 1965 as administered by Department for the Economy ("Economy").</li>
              <li>My Agricultural Return information will be used to calculate RSS payments, monitor the agriculture industry, facilitate ongoing administration of the Rural Economic Framework and grouped statistics will be used to provide annual agricultural statistic reports, which will be published on <a href="https://www.gov.je" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.gov.je</a>. That the information collected by Economy may be shared with IE and Jersey Business / Farm Jersey.</li>
              <li>That Economy Officers may contact LEAF to discuss the details of my LEAF accreditation process.</li>
              <li>My personal information will not be processed further unless permitted under a condition of the Data Protection (Jersey) Law 2018, or to comply with a legal requirement.</li>
            </ul>
            <p className="mt-3">
              I understand that under Jersey's Data Protection Law I have the right to withdraw my consent to the further processing of my information. However, I understand that this may affect my grant payment as well as be in breach of other laws. (Should you wish to exercise this right please contact us at <a href="mailto:ruraleconomy@gov.je" className="text-primary underline">ruraleconomy@gov.je</a>)
            </p>
          </div>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="declaration.declarationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter your full name" {...field} disabled={readOnly} data-testid="input-declaration-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="declaration.declarationDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} disabled={readOnly} data-testid="input-declaration-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="space-y-2">
        <FormLabel>Signature *</FormLabel>
        <Card className="p-4">
          <canvas
            ref={canvasRef}
            width={600}
            height={150}
            className={`border border-gray-300 rounded w-full bg-white ${readOnly ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            data-testid="canvas-signature"
          />
          {!readOnly && (
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
          )}
        </Card>
        {!signature && (
          <p className="text-sm text-destructive">Please sign above to complete the form</p>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderFarmDetailsSection();
      case 1:
        return renderAccreditationSection();
      case 2:
        return renderManagementSection();
      case 3:
        return renderFacilitiesSection();
      case 4:
        return renderLivestockSection();
      case 5:
        return renderTier3Section();
      case 6:
        return renderFinancialSection();
      case 7:
        return renderDeclarationSection();
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Agricultural Return 2026
            </CardTitle>
            <CardDescription>{STEPS[currentStep].description}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {STEPS.length}</p>
          </div>
        </div>
        <Progress value={progressPercentage} className="mt-4" />
      </CardHeader>
      
      <CardContent>
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {STEPS.map((step, index) => (
              <Button
                key={step.id}
                type="button"
                variant={index === currentStep ? "default" : index < currentStep ? "secondary" : "outline"}
                size="sm"
                onClick={() => setCurrentStep(index)}
                className="flex-shrink-0"
                data-testid={`step-button-${step.id}`}
              >
                {index < currentStep ? <Check className="h-4 w-4 mr-1" /> : null}
                {step.title.split(' - ')[0]}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{STEPS[currentStep].title}</h3>
        </div>
        
        <Form {...form}>
          <form className="space-y-6">
            <div key={STEPS[currentStep].id}>
              {renderCurrentStep()}
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  data-testid="button-previous"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                {currentStep < STEPS.length - 1 && (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    data-testid="button-next"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                {!readOnly && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveProgress}
                      disabled={saveMutation.isPending}
                      data-testid="button-save-progress"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Progress
                    </Button>
                    
                    {currentStep === STEPS.length - 1 && (
                      <Button
                        type="button"
                        onClick={handleComplete}
                        disabled={saveMutation.isPending || !signature}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-complete"
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Complete & Sign
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
