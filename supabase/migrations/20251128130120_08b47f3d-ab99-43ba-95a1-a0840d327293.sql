-- Allow public read access to po-documents bucket for external sharing
-- This enables contractors and others to view PDFs via direct links
CREATE POLICY "Public can view po-documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'po-documents');