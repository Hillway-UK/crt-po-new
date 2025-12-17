import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Database } from 'lucide-react';

export function SupabaseSetup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Database className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Supabase Connection Required</CardTitle>
          <CardDescription>
            Connect your Supabase project to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-2">To use this app, you need to:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Go to <strong>Connectors</strong> in the Lovable sidebar</li>
                  <li>Click on <strong>Supabase</strong></li>
                  <li>Connect your existing Supabase project</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Your Supabase project needs these tables:</p>
            <ul className="list-disc ml-4 space-y-1 text-xs">
              <li>users, organisations</li>
              <li>contractors, properties</li>
              <li>purchase_orders, invoices</li>
              <li>notifications, settings</li>
              <li>po_approval_logs, invoice_approval_logs</li>
            </ul>
          </div>

          <div className="pt-4 border-t text-center text-xs text-muted-foreground">
            Once connected, refresh this page to continue.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
