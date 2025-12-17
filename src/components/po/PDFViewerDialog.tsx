import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, X, ExternalLink } from 'lucide-react';

interface PDFViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  title: string;
}

export function PDFViewerDialog({ open, onOpenChange, pdfUrl, title }: PDFViewerDialogProps) {
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let currentBlobUrl: string | null = null;
    
    if (!open || !pdfUrl) {
      setBlobUrl(null);
      setError(null);
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(pdfUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch PDF');
        return res.blob();
      })
      .then(blob => {
        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF. Please try downloading it instead.');
        setLoading(false);
      });

    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [open, pdfUrl]);

  const handlePrint = () => {
    if (blobUrl) {
      const iframe = document.getElementById('pdf-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
      }
    }
  };

  const handleDownload = () => {
    if (blobUrl) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b pr-14">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex-shrink-0">{title}</DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!blobUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!blobUrl}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 relative bg-muted/20">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center max-w-md px-4">
                <p className="text-sm text-destructive mb-4">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => window.open(pdfUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}
          {blobUrl && !error && (
            <iframe
              id="pdf-iframe"
              src={blobUrl}
              className="w-full h-full border-0"
              title={title}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
