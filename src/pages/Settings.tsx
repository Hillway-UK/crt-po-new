import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Settings as SettingsIcon, Building2, Mail, FileText, Bell, Info, Workflow } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DelegationManager } from "@/components/delegations/DelegationManager";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Organisation form state
  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [accountsEmail, setAccountsEmail] = useState("");

  // Settings form state
  const [poPrefix, setPoPrefix] = useState("");
  const [nextPoNumber, setNextPoNumber] = useState<number>(1);
  const [defaultVatRate, setDefaultVatRate] = useState<number>(20);
  const [notifyPmEmail, setNotifyPmEmail] = useState("");
  const [notifyMdEmail, setNotifyMdEmail] = useState("");
  const [notifyAccountsEmail, setNotifyAccountsEmail] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [paymentTermsText, setPaymentTermsText] = useState("");

  const { data: organisation } = useQuery({
    queryKey: ["organisation", user?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("*").eq("id", user?.organisation_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organisation_id,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings", user?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("organisation_id", user?.organisation_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organisation_id,
  });

  // Initialize organisation form from fetched data
  useEffect(() => {
    if (organisation) {
      setOrgName(organisation.name || "");
      setOrgAddress(organisation.address || "");
      setOrgPhone(organisation.phone || "");
      setOrgWebsite(organisation.website || "");
      setAccountsEmail(organisation.accounts_email || "");
    }
  }, [organisation]);

  // Initialize settings form from fetched data
  useEffect(() => {
    if (settings) {
      setPoPrefix(settings.po_prefix || "");
      setNextPoNumber(settings.next_po_number || 1);
      setDefaultVatRate(Number(settings.default_vat_rate) || 20);
      setNotifyPmEmail(settings.notify_pm_email || "");
      setNotifyMdEmail(settings.notify_md_email || "");
      setNotifyAccountsEmail(settings.notify_accounts_email || "");
      setContractorEmail(settings.contractor_email || "");
      setPaymentTermsText(settings.payment_terms_text || "");
    }
  }, [settings]);

  const validateEmail = (email: string) => !email || email.includes("@");

  const handleSave = async () => {
    // Basic validation
    if (!orgName.trim()) {
      toast({
        title: "Validation Error",
        description: "Organization name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!accountsEmail.trim() || !accountsEmail.includes("@")) {
      toast({
        title: "Validation Error",
        description: "A valid default notification email is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate optional notification emails
    const emailFields = [
      { value: notifyPmEmail, name: "Property Manager notification email" },
      { value: notifyMdEmail, name: "MD notification email" },
      { value: notifyAccountsEmail, name: "Accounts notification email" },
      { value: contractorEmail, name: "Contractor notification email" },
    ];

    for (const field of emailFields) {
      if (!validateEmail(field.value)) {
        toast({
          title: "Validation Error",
          description: `${field.name} must be a valid email address.`,
          variant: "destructive",
        });
        return;
      }
    }

    if (defaultVatRate < 0 || defaultVatRate > 100) {
      toast({
        title: "Validation Error",
        description: "VAT rate must be between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    if (nextPoNumber < 1) {
      toast({
        title: "Validation Error",
        description: "Next PO number must be at least 1.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update organisation
      const { error: orgError } = await supabase
        .from("organisations")
        .update({
          name: orgName,
          address: orgAddress || null,
          phone: orgPhone || null,
          website: orgWebsite || null,
          accounts_email: accountsEmail,
        })
        .eq("id", user?.organisation_id);

      if (orgError) throw orgError;

      // Update settings
      const { error: settingsError } = await supabase
        .from("settings")
        .update({
          po_prefix: poPrefix,
          next_po_number: nextPoNumber,
          default_vat_rate: defaultVatRate,
          notify_pm_email: notifyPmEmail || null,
          notify_md_email: notifyMdEmail || null,
          notify_accounts_email: notifyAccountsEmail || null,
          contractor_email: contractorEmail || null,
          payment_terms_text: paymentTermsText,
        })
        .eq("organisation_id", user?.organisation_id);

      if (settingsError) throw settingsError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["organisation"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });

      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "CEO" && user?.role !== "MD") {
    return (
      <MainLayout title="Settings">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Access denied. Admin, CEO, or MD only.</div>
        </div>
      </MainLayout>
    );
  }

  // MD users only see the Delegation Manager
  if (user?.role === 'MD') {
    return (
      <MainLayout title="Settings">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">Approval Delegation</h2>
              <p className="text-muted-foreground">Manage your approval delegates</p>
            </div>
          </div>
          <DelegationManager />
        </div>
      </MainLayout>
    );
  }

  // ADMIN/CEO see full settings
  return (
    <MainLayout title="Settings">
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">System Settings</h2>
              <p className="text-muted-foreground">Manage organization and system configuration</p>
            </div>
          </div>

          {/* Workflow Settings Link */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/settings/workflows')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  <CardTitle>Approval Workflows</CardTitle>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <CardDescription>
                Set up custom approval thresholds, CEO escalation rules, and multi-step workflows
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Organisation Details</CardTitle>
                </div>
                <CardDescription>Your organization information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Enter organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-address">Address</Label>
                  <Input
                    id="org-address"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    placeholder="Enter address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-phone">Phone</Label>
                  <Input
                    id="org-phone"
                    value={orgPhone}
                    onChange={(e) => setOrgPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-website">Website</Label>
                  <Input
                    id="org-website"
                    value={orgWebsite}
                    onChange={(e) => setOrgWebsite(e.target.value)}
                    placeholder="Enter website URL"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle>Default Notification Email</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Used as the fallback sender for all system emails when role-specific emails are not configured.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>Fallback email for general notifications (e.g., User Invites)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accounts-email">Default Email</Label>
                  <Input
                    id="accounts-email"
                    type="email"
                    value={accountsEmail}
                    onChange={(e) => setAccountsEmail(e.target.value)}
                    placeholder="Enter default notification email"
                  />
                  <p className="text-xs text-muted-foreground">Required. This email is used when role-specific emails below are not set.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle>Notification Preferences</CardTitle>
                </div>
                <CardDescription>Configure role-specific notification emails (all optional)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notify-pm-email">Property Manager Notification Email</Label>
                  <Input
                    id="notify-pm-email"
                    type="email"
                    value={notifyPmEmail}
                    onChange={(e) => setNotifyPmEmail(e.target.value)}
                    placeholder="Enter PM notification email"
                  />
                  <p className="text-xs text-muted-foreground">Optional - uses default email if empty</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notify-md-email">MD Notification Email</Label>
                  <Input
                    id="notify-md-email"
                    type="email"
                    value={notifyMdEmail}
                    onChange={(e) => setNotifyMdEmail(e.target.value)}
                    placeholder="Enter MD notification email"
                  />
                  <p className="text-xs text-muted-foreground">Optional - uses default email if empty</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notify-accounts-email">Accounts Notification Email</Label>
                  <Input
                    id="notify-accounts-email"
                    type="email"
                    value={notifyAccountsEmail}
                    onChange={(e) => setNotifyAccountsEmail(e.target.value)}
                    placeholder="Enter Accounts notification email"
                  />
                  <p className="text-xs text-muted-foreground">Optional - uses default email if empty</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractor-email">Contractor Notification Email</Label>
                  <Input
                    id="contractor-email"
                    type="email"
                    value={contractorEmail}
                    onChange={(e) => setContractorEmail(e.target.value)}
                    placeholder="Enter contractor notification email"
                  />
                  <p className="text-xs text-muted-foreground">Optional - uses default email if empty</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle>Purchase Order Settings</CardTitle>
                </div>
                <CardDescription>Configure PO numbering and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="po-prefix">PO Prefix</Label>
                  <Input
                    id="po-prefix"
                    value={poPrefix}
                    onChange={(e) => setPoPrefix(e.target.value)}
                    placeholder="Enter PO prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next-po">Next PO Number</Label>
                  <Input
                    id="next-po"
                    type="number"
                    value={nextPoNumber}
                    onChange={(e) => setNextPoNumber(Number(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat-rate">Default VAT Rate (%)</Label>
                  <Input
                    id="vat-rate"
                    type="number"
                    value={defaultVatRate}
                    onChange={(e) => setDefaultVatRate(Number(e.target.value))}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-terms">Payment Terms Text</Label>
                  <Textarea
                    id="payment-terms"
                    value={paymentTermsText}
                    onChange={(e) => setPaymentTermsText(e.target.value)}
                    placeholder="Enter payment terms text"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}