-- Make po-documents bucket public to allow PDF downloads
UPDATE storage.buckets 
SET public = true 
WHERE id = 'po-documents';