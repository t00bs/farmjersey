import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function extractFields() {
  const pdfBytes = fs.readFileSync('server/templates/RSS_Application_2026_Template.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  console.log('Found', fields.length, 'form fields:\n');
  
  fields.forEach((field, index) => {
    const type = field.constructor.name;
    const name = field.getName();
    console.log(`${index + 1}. [${type}] "${name}"`);
  });
}

extractFields().catch(console.error);
