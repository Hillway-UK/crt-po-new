import { Button } from '@/components/ui/button';
import { Upload, CheckCircle } from 'lucide-react';
import { validateInvoiceFile } from '@/services/invoiceService';
import { toast } from '@/components/ui/use-toast';

interface InvoiceFileUploadStepProps {
  file: File | null;
  onFileSelected: (file: File) => void;
  onNext: () => void;
}

export function InvoiceFileUploadStep({ file, onFileSelected, onNext }: InvoiceFileUploadStepProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateInvoiceFile(selectedFile);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    onFileSelected(selectedFile);
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag invoice PDF here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">PDF only, max 10MB</p>
        <input
          id="file-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      <Button onClick={onNext} disabled={!file} className="w-full">
        Next
      </Button>
    </div>
  );
}
