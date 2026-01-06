import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a signed URL for a file in the po-documents bucket.
 * The file path should be the path stored in the database (e.g., "pos/CRT-2025-001.pdf")
 * @param filePath - The path to the file in storage (without bucket name)
 * @param expiresIn - URL expiry time in seconds (default: 1 hour)
 * @returns The signed URL or null if generation fails
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!filePath) return null;

  // If it's already a full URL, extract the path
  const path = extractStoragePath(filePath);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from('po-documents')
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Failed to generate signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Extracts the storage path from a URL or returns the path if it's already a path.
 * Handles both public URLs and plain paths.
 * @param urlOrPath - Either a full storage URL or a path
 * @returns The storage path without the bucket/URL prefix
 */
export function extractStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;

  // If it's a plain path (no http), return as-is
  if (!urlOrPath.startsWith('http')) {
    return urlOrPath;
  }

  // Extract path from Supabase storage URL
  // URL format: https://{project}.supabase.co/storage/v1/object/public/po-documents/{path}
  // or: https://{project}.supabase.co/storage/v1/object/sign/po-documents/{path}
  const patterns = [
    /\/storage\/v1\/object\/public\/po-documents\/(.+)$/,
    /\/storage\/v1\/object\/sign\/po-documents\/(.+?)(?:\?|$)/,
  ];

  for (const pattern of patterns) {
    const match = urlOrPath.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // If we can't extract the path, return null
  console.warn('Could not extract storage path from:', urlOrPath);
  return null;
}

/**
 * Downloads a file from storage using a signed URL
 * @param filePath - The path to the file in storage
 * @param filename - The filename for the download
 */
export async function downloadStorageFile(
  filePath: string,
  filename: string
): Promise<void> {
  const signedUrl = await getSignedUrl(filePath);
  
  if (!signedUrl) {
    throw new Error('Failed to generate download URL');
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(blobUrl);
}
