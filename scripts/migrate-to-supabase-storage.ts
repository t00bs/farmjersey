import { db } from '../server/db';
import { documents } from '../shared/schema';
import { ensureBucketExists, uploadFileFromPath, isSupabasePath } from '../server/supabaseStorage';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';

async function migrateFilesToSupabaseStorage() {
  console.log('Starting migration to Supabase Storage...');
  
  // Ensure bucket exists
  const bucketReady = await ensureBucketExists();
  if (!bucketReady) {
    console.error('Failed to ensure Supabase bucket exists. Aborting migration.');
    process.exit(1);
  }
  
  // Get all documents that are still using local storage
  const allDocuments = await db.select().from(documents);
  
  const localDocuments = allDocuments.filter(doc => 
    doc.filePath && !isSupabasePath(doc.filePath)
  );
  
  console.log(`Found ${localDocuments.length} documents to migrate out of ${allDocuments.length} total`);
  
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  
  for (const doc of localDocuments) {
    console.log(`Processing document ${doc.id}: ${doc.fileName}`);
    
    // Check if local file exists
    if (!fs.existsSync(doc.filePath)) {
      console.warn(`  File not found locally: ${doc.filePath}`);
      skippedCount++;
      continue;
    }
    
    // Upload to Supabase Storage
    const { path: storagePath, error } = await uploadFileFromPath(
      doc.filePath,
      doc.fileName,
      doc.fileType,
      doc.applicationId,
      doc.documentType
    );
    
    if (error || !storagePath) {
      console.error(`  Failed to upload: ${error?.message || 'Unknown error'}`);
      failCount++;
      continue;
    }
    
    // Update database record with new path
    await db.update(documents)
      .set({ filePath: storagePath })
      .where(eq(documents.id, doc.id));
    
    console.log(`  Migrated to: ${storagePath}`);
    
    // Optionally delete local file after successful migration
    try {
      fs.unlinkSync(doc.filePath);
      console.log(`  Deleted local file: ${doc.filePath}`);
    } catch (err) {
      console.warn(`  Warning: Could not delete local file: ${doc.filePath}`);
    }
    
    successCount++;
  }
  
  console.log('\n--- Migration Summary ---');
  console.log(`Total documents: ${allDocuments.length}`);
  console.log(`Already in Supabase: ${allDocuments.length - localDocuments.length}`);
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped (file not found): ${skippedCount}`);
  
  process.exit(failCount > 0 ? 1 : 0);
}

migrateFilesToSupabaseStorage().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
