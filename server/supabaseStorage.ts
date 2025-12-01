import { supabaseAdmin } from './supabase';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'documents';

export async function ensureBucketExists(): Promise<boolean> {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: [
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        return false;
      }
      
      console.log(`Created Supabase Storage bucket: ${BUCKET_NAME}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
}

export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  applicationId: number,
  documentType: string
): Promise<{ path: string; error: Error | null }> {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${applicationId}/${documentType}/${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return { path: '', error: new Error(error.message) };
    }

    return { path: data.path, error: null };
  } catch (error) {
    console.error('Error uploading file to Supabase:', error);
    return { path: '', error: error as Error };
  }
}

export async function uploadFileFromPath(
  localFilePath: string,
  fileName: string,
  mimeType: string,
  applicationId: number,
  documentType: string
): Promise<{ path: string; error: Error | null }> {
  try {
    const fileBuffer = fs.readFileSync(localFilePath);
    return await uploadFile(fileBuffer, fileName, mimeType, applicationId, documentType);
  } catch (error) {
    console.error('Error reading file for upload:', error);
    return { path: '', error: error as Error };
  }
}

export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<{ url: string; error: Error | null }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return { url: '', error: new Error(error.message) };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return { url: '', error: error as Error };
  }
}

export async function downloadFile(
  storagePath: string
): Promise<{ data: Buffer | null; error: Error | null }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      console.error('Error downloading file:', error);
      return { data: null, error: new Error(error.message) };
    }

    const arrayBuffer = await data.arrayBuffer();
    return { data: Buffer.from(arrayBuffer), error: null };
  } catch (error) {
    console.error('Error downloading file from Supabase:', error);
    return { data: null, error: error as Error };
  }
}

export async function deleteFile(
  storagePath: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting file from Supabase:', error);
    return { success: false, error: error as Error };
  }
}

export async function deleteMultipleFiles(
  storagePaths: string[]
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (storagePaths.length === 0) {
      return { success: true, error: null };
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove(storagePaths);

    if (error) {
      console.error('Error deleting files:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting files from Supabase:', error);
    return { success: false, error: error as Error };
  }
}

export function isSupabasePath(filePath: string): boolean {
  return !filePath.startsWith('uploads/') && !filePath.startsWith('/') && !filePath.startsWith('./');
}
