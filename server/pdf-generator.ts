import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import type { AgriculturalReturn } from '@shared/schema';

const TEMPLATE_PATH = path.join(process.cwd(), 'server/templates/RSS_Application_2026_Template.pdf');

interface FarmDetails {
  farmName?: string;
  farmCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  parish?: string;
  postcode?: string;
  telephone?: string;
  email?: string;
}

interface AccreditationData {
  leafOption?: string;
  organicOption?: string;
  // Certifications are stored at the top level, not nested
  brcGlobal?: boolean;
  globalGap?: boolean;
  redTractor?: boolean;
  salsa?: boolean;
  kiwa?: boolean;
  britishHorseSociety?: boolean;
}

interface ManagementPlans {
  soilPlan?: boolean;
  waterPlan?: boolean;
  nutrientPlan?: boolean;
  wastePlan?: boolean;
  animalHealthPlan?: boolean;
  conservationPlan?: boolean;
  energyAudit?: boolean;
  carbonNetZeroPlan?: boolean;
  carbonDataCollection?: boolean;
  woodlandPlan?: boolean;
  dairyWelfareVet?: boolean;
  healthSafetyPlan?: boolean;
}

interface FacilitiesData {
  pesticideStoreCount?: number;
  pesticideStoreAddress?: string;
  slurryStoreCount?: number;
  slurryCapacityLitres?: number;
}

interface LivestockData {
  pigs?: number;
  sheep?: number;
  goats?: number;
  chickens?: number;
  otherFowl?: number;
  horsesOwned?: number;
  horsesLivery?: number;
  donkeysMules?: number;
  other?: number;
  otherSpecify?: string;
}

interface Tier3Data {
  eatSafeStars?: number;
  genuineJerseyMember?: boolean;
  greatTasteProducts?: string;
  farmOpenDays?: number;
  publicFootpathsMeters?: number;
  wildlifePonds?: number;
  wasteRecyclingTonnes?: number;
}

interface FinancialData {
  produceSalesExport?: number;
  produceSalesLocal?: number;
  servicesRental?: number;
  grantsSupport?: number;
  otherIncome?: number;
  totalIncome?: number;
  wagesSalaries?: number;
  itis?: number;
  socialSecurity?: number;
  propertyRental?: number;
  allOtherExpenses?: number;
  tradingProfit?: number;
}

export async function generateFilledPDF(agriculturalReturn: AgriculturalReturn): Promise<Buffer> {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  const farmDetails = (agriculturalReturn.farmDetailsData || {}) as FarmDetails;
  const accreditation = (agriculturalReturn.accreditationData || {}) as AccreditationData;
  const management = (agriculturalReturn.managementPlans || {}) as ManagementPlans;
  const facilities = (agriculturalReturn.facilitiesData || {}) as FacilitiesData;
  const livestock = (agriculturalReturn.livestockData || {}) as LivestockData;
  const tier3 = (agriculturalReturn.tier3Data || {}) as Tier3Data;
  const financial = (agriculturalReturn.financialData || {}) as FinancialData;

  const setTextField = (fieldName: string, value: string | number | undefined | null) => {
    try {
      const field = form.getTextField(fieldName);
      if (value !== undefined && value !== null && value !== '') {
        field.setText(String(value));
      }
    } catch (e) {
      console.warn(`PDF field not found: ${fieldName}`);
    }
  };

  const setCheckbox = (fieldName: string, checked: boolean | undefined) => {
    if (!checked) return;
    
    // Try checkbox first
    try {
      const checkboxField = form.getCheckBox(fieldName);
      checkboxField.check();
      return;
    } catch {
      // Not a checkbox, try text field
    }
    
    // Fallback to text field with 'X'
    try {
      const textField = form.getTextField(fieldName);
      textField.setText('X');
    } catch (e) {
      console.warn(`PDF field not found: ${fieldName}`);
    }
  };

  setTextField('Farm Name', farmDetails.farmName);
  setTextField('Farm Code', farmDetails.farmCode);
  setTextField('Address Line 1', farmDetails.addressLine1);
  setTextField('Address Line 2', farmDetails.addressLine2);
  setTextField('Parish', farmDetails.parish);
  setTextField('Postcode', farmDetails.postcode);
  
  // Set farm name in the declaration consent section
  setTextField('Signed on behalf of', farmDetails.farmName);

  switch (accreditation.leafOption) {
    case 'demoFarm':
      setTextField('LEAF Marque Demonstration Farm', 'X');
      break;
    case 'certified':
      setTextField('LEAF Marque Ceritified', 'X');
      break;
    case 'sfr':
      setTextField('LEAF Sustainable Farming Review', 'X');
      break;
    case 'member':
      setTextField('LEAF Member', 'X');
      break;
  }

  switch (accreditation.organicOption) {
    case 'certified':
      setTextField('Organic Certified', 'X');
      break;
    case 'inConversion':
      setTextField("Organic 'In Conversion'", 'X');
      break;
    case 'member':
      setTextField('Member of an Organic Association', 'X');
      break;
  }

  // Certifications are stored at top level of accreditation object
  setCheckbox('Red Tractor', accreditation.redTractor);
  setCheckbox('SALSA', accreditation.salsa);
  setCheckbox('KIWA', accreditation.kiwa);
  setCheckbox('Global GAP', accreditation.globalGap);
  setCheckbox('British Horse Society', accreditation.britishHorseSociety);
  setCheckbox('BRC Global Standard', accreditation.brcGlobal);

  setCheckbox('Soil Management Plan', management.soilPlan);
  setCheckbox('Water Management Plan', management.waterPlan);
  setCheckbox('Nutrient Management Plan', management.nutrientPlan);
  setCheckbox('Waste Management Plan', management.wastePlan);
  setCheckbox('Animal Health Plan', management.animalHealthPlan);
  setCheckbox('Conservation and Landscape Plan', management.conservationPlan);
  setCheckbox('Energy Audit and Plan', management.energyAudit);
  setCheckbox('Carbon Net Zero Plan', management.carbonNetZeroPlan);
  setCheckbox('Carbon Net Zero Data Collection', management.carbonDataCollection);
  setCheckbox('Woodland Management Plan', management.woodlandPlan);
  setCheckbox('Dairy Welfare Vet Scheme', management.dairyWelfareVet);
  setCheckbox('Health and Safety Plan', management.healthSafetyPlan);

  setTextField('Number of stores', facilities.pesticideStoreCount);
  setTextField('Address (if different from main)', facilities.pesticideStoreAddress);
  setTextField('Number of stores_2', facilities.slurryStoreCount);
  setTextField('Total Capacity litres', facilities.slurryCapacityLitres);

  setTextField('Pigs', livestock.pigs);
  setTextField('Sheep', livestock.sheep);
  setTextField('Goats', livestock.goats);
  setTextField('Chickens', livestock.chickens);
  setTextField('Other Fowl', livestock.otherFowl);
  setTextField('Horses Owned', livestock.horsesOwned);
  setTextField('Horses Livery', livestock.horsesLivery);
  setTextField('Donkeys  Mules', livestock.donkeysMules);
  setTextField('Other please specify', livestock.otherSpecify);

  setTextField('Eat Safe Jersey Number Stars', tier3.eatSafeStars);
  setCheckbox('Genuine Jersey Member tick', tier3.genuineJerseyMember);
  setTextField('Great Taste Awards Product and number stars', tier3.greatTasteProducts);
  setTextField('Number farm open days in 2025', tier3.farmOpenDays);
  setTextField('Maintained Public Footpaths m', tier3.publicFootpathsMeters);
  setTextField('Number of Wildlife Ponds', tier3.wildlifePonds);
  setTextField('Waste Recycling (plastic/oil/packaging - tonnes recycled)', tier3.wasteRecyclingTonnes);

  setTextField('Produce Sales Export', financial.produceSalesExport);
  setTextField('Produce Sales Local', financial.produceSalesLocal);
  setTextField('Services and Rental', financial.servicesRental);
  setTextField('GrantsSupport', financial.grantsSupport);
  setTextField('Other Income', financial.otherIncome);
  setTextField('Total Income', financial.totalIncome);
  setTextField('Wages and Salaries', financial.wagesSalaries);
  setTextField('ITIS', financial.itis);
  setTextField('Social Security', financial.socialSecurity);
  setTextField('Property Rental', financial.propertyRental);
  setTextField('ALL Other Expenses', financial.allOtherExpenses);
  setTextField('Trading Profit Loss', financial.tradingProfit);

  setTextField('Full Name', agriculturalReturn.declarationName);
  if (agriculturalReturn.declarationDate) {
    const date = new Date(agriculturalReturn.declarationDate);
    setTextField('Date', date.toLocaleDateString('en-GB'));
  }

  if (agriculturalReturn.declarationSignature) {
    try {
      const signatureField = form.getTextField('Signed');
      const base64Data = agriculturalReturn.declarationSignature.replace(/^data:image\/\w+;base64,/, '');
      const signatureBytes = Buffer.from(base64Data, 'base64');
      
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      
      const widgets = signatureField.acroField.getWidgets();
      if (widgets.length > 0) {
        const widget = widgets[0];
        const rect = widget.getRectangle();
        // The Signed field is on page 4 (index 3)
        const pages = pdfDoc.getPages();
        const page = pages[3]; // Page 4 (0-indexed)
        
        const imageWidth = rect.width - 4;
        const imageHeight = rect.height - 4;
        const aspectRatio = signatureImage.width / signatureImage.height;
        
        let drawWidth = imageWidth;
        let drawHeight = imageWidth / aspectRatio;
        
        if (drawHeight > imageHeight) {
          drawHeight = imageHeight;
          drawWidth = imageHeight * aspectRatio;
        }
        
        const x = rect.x + (rect.width - drawWidth) / 2;
        const y = rect.y + (rect.height - drawHeight) / 2;
        
        page.drawImage(signatureImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
        
        signatureField.setText('');
      }
    } catch (e) {
      console.error('Error embedding signature:', e);
    }
  }

  form.flatten();

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
