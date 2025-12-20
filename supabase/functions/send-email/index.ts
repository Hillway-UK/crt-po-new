import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'po_approval_request' | 'po_pm_approval_request' | 'po_approved_contractor' | 'po_approved_accounts' | 'po_approved_pm' | 'po_rejected' | 'po_ceo_approval_request' | 'invoice_needs_approval' | 'invoice_approved_accounts' | 'invoice_approved_pm' | 'invoice_rejected' | 'invoice_paid' | 'user_invitation' | 'delegation_assigned' | 'delegation_reactivated' | 'delegation_expired';
  po_id?: string;
  invoice_id?: string;
  invitation_id?: string;
  delegation_id?: string;
  template?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, po_id, invoice_id, invitation_id, delegation_id }: EmailRequest = await req.json();

    if (!type) {
      return new Response(
        JSON.stringify({ error: 'Email type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let po, invoice;

    // Fetch data based on type
    if (po_id) {
      console.log(`Sending ${type} email for PO:`, po_id);
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          contractor:contractors(*),
          property:properties(*),
          created_by:users!created_by_user_id(*),
          approved_by:users!approved_by_user_id(*),
          organisation:organisations(*)
        `)
        .eq('id', po_id)
        .single();

      if (poError) {
        console.error('Error fetching PO:', poError);
        throw poError;
      }
      po = poData;
    }

    if (invoice_id) {
      console.log(`Sending ${type} email for Invoice:`, invoice_id);
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          contractor:contractors(*),
          purchase_order:purchase_orders(*, created_by:users!purchase_orders_created_by_user_id_fkey(*)),
          uploaded_by:users!invoices_uploaded_by_user_id_fkey(*),
          approved_by:users!invoices_approved_by_user_id_fkey(*)
        `)
        .eq('id', invoice_id)
        .single();

      if (invoiceError) {
        console.error('Error fetching Invoice:', invoiceError);
        throw invoiceError;
      }
      invoice = invoiceData;
    }

    let invitation;
    if (invitation_id) {
      console.log(`Sending ${type} email for Invitation:`, invitation_id);
      const { data: invitationData, error: invitationError } = await supabase
        .from('user_invitations')
        .select(`
          *,
          organisation:organisations(*),
          invited_by:users!user_invitations_invited_by_user_id_fkey(*)
        `)
        .eq('id', invitation_id)
        .single();

      if (invitationError) {
        console.error('Error fetching Invitation:', invitationError);
        throw invitationError;
      }
      invitation = invitationData;
    }

    // Fetch delegation early so we can use its organisation_id for email settings
    let delegation;
    if (delegation_id) {
      console.log(`Fetching delegation for email:`, delegation_id);
      const { data: delegationData, error: delegationError } = await supabase
        .from('approval_delegations')
        .select(`
          *,
          delegator:users!delegator_user_id(*),
          delegate:users!delegate_user_id(*)
        `)
        .eq('id', delegation_id)
        .single();

      if (!delegationError && delegationData) {
        delegation = delegationData;
      }
    }

    // Determine organisation ID from available data
    const orgId = po?.organisation_id || invoice?.organisation_id || invitation?.organisation_id || delegation?.delegator?.organisation_id;

    // Get email settings
    const { data: settings } = await supabase
      .from('settings')
      .select('notify_md_email, contractor_email, notify_pm_email, notify_accounts_email')
      .eq('organisation_id', orgId)
      .single();

    // Get organisation for default notification email (accounts_email)
    let defaultNotificationEmail = 'accounts@crtproperty.co.uk';
    if (orgId) {
      const { data: org } = await supabase
        .from('organisations')
        .select('accounts_email')
        .eq('id', orgId)
        .single();
      
      if (org?.accounts_email) {
        defaultNotificationEmail = org.accounts_email;
        console.log(`Using organisation email: ${defaultNotificationEmail}`);
      }
    }

    // Fetch MD, ADMIN, CEO, and PM users for the organization
    let mdAdminUsers: { email: string; full_name: string }[] = [];
    let accountsAdminUsers: { email: string; full_name: string }[] = [];
    let ceoUsers: { email: string; full_name: string }[] = [];
    let pmUsers: { email: string; full_name: string }[] = [];
    if (orgId) {
      const { data: mdUsers } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('organisation_id', orgId)
        .in('role', ['MD', 'ADMIN'])
        .eq('is_active', true);
      
      if (mdUsers && mdUsers.length > 0) {
        mdAdminUsers = mdUsers;
      }

      const { data: accountsUsers } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('organisation_id', orgId)
        .in('role', ['ACCOUNTS', 'ADMIN'])
        .eq('is_active', true);
      
      if (accountsUsers && accountsUsers.length > 0) {
        accountsAdminUsers = accountsUsers;
      }

      // Fetch CEO users for the organization
      const { data: ceoUsersData } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('organisation_id', orgId)
        .eq('role', 'CEO')
        .eq('is_active', true);
      
      if (ceoUsersData && ceoUsersData.length > 0) {
        ceoUsers = ceoUsersData;
      }

      // Fetch PM users for the organization
      const { data: pmUsersData } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('organisation_id', orgId)
        .in('role', ['PROPERTY_MANAGER', 'ADMIN'])
        .eq('is_active', true);
      
      if (pmUsersData && pmUsersData.length > 0) {
        pmUsers = pmUsersData;
      }
    }

    // Configure email addresses with fallbacks to default notification email
    const pmEmail = settings?.notify_pm_email || defaultNotificationEmail;
    const mdEmail = settings?.notify_md_email || defaultNotificationEmail;
    const accountsEmail = settings?.notify_accounts_email || defaultNotificationEmail;
    const contractorEmail = settings?.contractor_email || defaultNotificationEmail;
    const appUrl = (Deno.env.get('APP_URL') || 'https://crt-approvals.lovable.app').replace(/\/+$/, '');

    // Helper to format from address
    const formatFromEmail = (email: string, name: string = 'CRT Property') => {
      return `${name} <${email}>`;
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(amount);
    };

const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    // Helper to generate signed URL from storage path
    const getSignedPdfUrl = async (storagePath: string | null): Promise<string | null> => {
      if (!storagePath) return null;
      
      // If it's already a full URL, return as-is (backward compatibility)
      if (storagePath.startsWith('http')) {
        return storagePath;
      }
      
      // Extract filename from storage path for download
      const filename = storagePath.split('/').pop() || 'purchase-order.pdf';
      
      // Generate a signed URL that expires in 7 days (for email recipients)
      // The download option forces browser to download instead of opening
      const { data, error } = await supabase.storage
        .from('po-documents')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7, { 
          download: filename 
        });
      
      if (error) {
        console.error('Failed to generate signed URL:', error);
        return null;
      }
      
      console.log('Generated signed URL for:', storagePath);
      return data.signedUrl;
    };

    let emailResult;

    switch (type) {
      case 'delegation_assigned': {
        if (!delegation_id) {
          throw new Error('delegation_id is required for delegation_assigned email');
        }
        
        // Delegation was already fetched earlier for org email lookup
        if (!delegation) {
          console.error('Delegation not found for id:', delegation_id);
          throw new Error('Delegation not found');
        }
        
        const delegatorName = delegation.delegator?.full_name || 'An MD';
        const delegateName = delegation.delegate?.full_name || 'Delegate';
        const delegateEmail = delegation.delegate?.email;
        
        if (!delegateEmail) {
          throw new Error('Delegate email not found');
        }
        
        // Format date range info
        let dateInfo = 'Your delegation is active immediately and indefinitely.';
        if (delegation.starts_at && delegation.ends_at) {
          dateInfo = `Your delegation is active from ${formatDate(delegation.starts_at)} until ${formatDate(delegation.ends_at)}.`;
        } else if (delegation.starts_at) {
          dateInfo = `Your delegation will be active from ${formatDate(delegation.starts_at)} onwards.`;
        } else if (delegation.ends_at) {
          dateInfo = `Your delegation is active immediately until ${formatDate(delegation.ends_at)}.`;
        }
        
        console.log(`Sending delegation assignment email to ${delegateEmail}`);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(defaultNotificationEmail, 'CRT Property Approvals'),
          to: [delegateEmail],
          subject: `You've been assigned as an Approval Delegate`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6B4190 0%, #5A3576 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Approval Delegation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been assigned as a delegate</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Dear ${delegateName},
                </p>
                
                <p style="color: #666; line-height: 1.6;">
                  <strong>${delegatorName}</strong> has assigned you as an approval delegate for Purchase Orders.
                </p>
                
                <div style="background: white; border-left: 4px solid #6B4190; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #6B4190;">What this means:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
                    <li>You can now approve POs on behalf of ${delegatorName}</li>
                    <li>You will receive approval request notifications</li>
                    <li>Your approvals will be logged as "on behalf of ${delegatorName}"</li>
                  </ul>
                </div>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666;">
                    ${dateInfo}
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/approvals" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Pending Approvals
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;
      }

      case 'delegation_reactivated': {
        if (!delegation_id) {
          throw new Error('delegation_id is required for delegation_reactivated email');
        }
        
        if (!delegation) {
          console.error('Delegation not found for id:', delegation_id);
          throw new Error('Delegation not found');
        }
        
        const delegatorName = delegation.delegator?.full_name || 'An MD';
        const delegateName = delegation.delegate?.full_name || 'Delegate';
        const delegateEmail = delegation.delegate?.email;
        
        if (!delegateEmail) {
          throw new Error('Delegate email not found');
        }
        
        // Format date range info
        let dateInfo = 'Your delegation is active immediately and indefinitely.';
        if (delegation.starts_at && delegation.ends_at) {
          dateInfo = `Your delegation is active from ${formatDate(delegation.starts_at)} until ${formatDate(delegation.ends_at)}.`;
        } else if (delegation.starts_at) {
          dateInfo = `Your delegation will be active from ${formatDate(delegation.starts_at)} onwards.`;
        } else if (delegation.ends_at) {
          dateInfo = `Your delegation is active immediately until ${formatDate(delegation.ends_at)}.`;
        }
        
        console.log(`Sending delegation reactivation email to ${delegateEmail}`);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(defaultNotificationEmail, 'CRT Property Approvals'),
          to: [delegateEmail],
          subject: `Your Approval Delegation has been Reactivated`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Delegation Reactivated</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">You can now approve POs again</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Dear ${delegateName},
                </p>
                
                <p style="color: #666; line-height: 1.6;">
                  <strong>${delegatorName}</strong> has reactivated your approval delegation for Purchase Orders.
                </p>
                
                <div style="background: white; border-left: 4px solid #059669; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #059669;">What this means:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
                    <li>You can now approve POs on behalf of ${delegatorName}</li>
                    <li>You will receive approval request notifications</li>
                    <li>Your approvals will be logged as "on behalf of ${delegatorName}"</li>
                  </ul>
                </div>
                
                <div style="background: #ecfdf5; padding: 15px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #a7f3d0;">
                  <p style="margin: 0; color: #047857;">
                    ${dateInfo}
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/approvals" 
                     style="display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Pending Approvals
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;
      }

      case 'delegation_expired': {
        if (!delegation_id) {
          throw new Error('delegation_id is required for delegation_expired email');
        }
        
        if (!delegation) {
          console.error('Delegation not found for id:', delegation_id);
          throw new Error('Delegation not found');
        }
        
        const delegatorName = delegation.delegator?.full_name || 'An MD';
        const delegateName = delegation.delegate?.full_name || 'Delegate';
        const delegateEmail = delegation.delegate?.email;
        
        if (!delegateEmail) {
          throw new Error('Delegate email not found');
        }
        
        console.log(`Sending delegation expired email to ${delegateEmail}`);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(defaultNotificationEmail, 'CRT Property Approvals'),
          to: [delegateEmail],
          subject: `Your Approval Delegation has Expired`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Delegation Expired</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your delegation period has ended</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Dear ${delegateName},
                </p>
                
                <p style="color: #666; line-height: 1.6;">
                  Your approval delegation for <strong>${delegatorName}</strong> has expired and is no longer active.
                </p>
                
                <div style="background: white; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #6b7280;">What this means:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
                    <li>You can no longer approve POs on behalf of ${delegatorName}</li>
                    <li>You will no longer receive approval notifications for their POs</li>
                    <li>Contact ${delegatorName} if you need to extend your delegation</li>
                  </ul>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  If this delegation needs to be extended, please contact the MD to reactivate it.
                </p>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;
      }

      case 'po_approval_request': {
        // Get all MD/ADMIN recipients
        let approvalRecipients = mdAdminUsers.length > 0 
          ? mdAdminUsers.map(u => u.email) 
          : [mdEmail];
        
        // Fetch active delegates for all MDs in the organization
        if (orgId) {
          const { data: mdUsers } = await supabase
            .from('users')
            .select('id')
            .eq('organisation_id', orgId)
            .eq('role', 'MD')
            .eq('is_active', true);
          
          if (mdUsers && mdUsers.length > 0) {
            const mdIds = mdUsers.map(u => u.id);
            
            const { data: activeDelegations } = await supabase
              .from('approval_delegations')
              .select(`
                *,
                delegate:users!delegate_user_id(email, full_name)
              `)
              .in('delegator_user_id', mdIds)
              .eq('scope', 'PO_APPROVAL')
              .eq('is_active', true);
            
            if (activeDelegations && activeDelegations.length > 0) {
              const now = new Date();
              const activeDelegateEmails = activeDelegations
                .filter((d: any) => {
                  const startsAt = d.starts_at ? new Date(d.starts_at) : null;
                  const endsAt = d.ends_at ? new Date(d.ends_at) : null;
                  const afterStart = !startsAt || now >= startsAt;
                  const beforeEnd = !endsAt || now <= endsAt;
                  return afterStart && beforeEnd;
                })
                .map((d: any) => d.delegate?.email)
                .filter(Boolean);
              
              // Merge with existing recipients and dedupe
              approvalRecipients = [...new Set([...approvalRecipients, ...activeDelegateEmails])];
            }
          }
        }
        
        console.log(`Sending PO approval request to ${approvalRecipients.length} recipient(s):`, approvalRecipients);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: approvalRecipients,
          subject: `New PO Requires Approval: ${po.po_number} - ${formatCurrency(Number(po.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6B4190 0%, #5A3576 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">New Purchase Order</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Requires Your Approval</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  A new purchase order requires your approval:
                </p>
                
                <div style="background: white; border-left: 4px solid #6B4190; padding: 20px; margin-bottom: 20px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #6B4190; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                    ${po.property ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Property:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.property.name}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666;"><strong>Description:</strong></p>
                  <p style="margin: 10px 0 0 0; color: #333;">${po.description.substring(0, 200)}${po.description.length > 200 ? '...' : ''}</p>
                </div>
                
                <div style="background: #fff; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    <strong>Requested by:</strong> ${po.created_by.full_name}<br>
                    <strong>Date:</strong> ${formatDate(po.created_at)}
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/approvals" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View in Approvals Hub
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;
      }

      case 'po_pm_approval_request':
        // Get all PM/ADMIN recipients or fallback to configured pmEmail
        const pmApprovalRecipients = pmUsers.length > 0 
          ? pmUsers.map(u => u.email) 
          : [pmEmail];
        
        console.log(`Sending PO PM approval request to ${pmApprovalRecipients.length} recipient(s):`, pmApprovalRecipients);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(pmEmail, 'CRT Property Approvals'),
          to: pmApprovalRecipients,
          subject: `New PO Requires PM Approval: ${po.po_number} - ${formatCurrency(Number(po.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">New Purchase Order</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Requires Your Approval</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  A new purchase order requires your approval:
                </p>
                
                <div style="background: white; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 20px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #3b82f6; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                    ${po.property ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Property:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.property.name}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666;"><strong>Description:</strong></p>
                  <p style="margin: 10px 0 0 0; color: #333;">${po.description.substring(0, 200)}${po.description.length > 200 ? '...' : ''}</p>
                </div>
                
                <div style="background: #fff; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    <strong>Requested by:</strong> ${po.created_by.full_name}<br>
                    <strong>Date:</strong> ${formatDate(po.created_at)}
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/approvals" 
                     style="display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View in Approvals Hub
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'po_approved_contractor':
        // Get PDF storage path or generate if not exists
        let pdfPath = po.pdf_url;
        if (!pdfPath) {
          // Trigger PDF generation
          const pdfResponse = await supabase.functions.invoke('generate-po-pdf', {
            body: { po_id: po.id }
          });
          pdfPath = pdfResponse.data?.pdf_url;
        }
        
        // Generate signed URL from storage path
        const pdfUrl = await getSignedPdfUrl(pdfPath);

        emailResult = await resend.emails.send({
          from: formatFromEmail(contractorEmail, 'CRT Property'),
          to: [po.contractor.email],
          subject: `Purchase Order ${po.po_number} - CRT Property Investments Ltd`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6B4190 0%, #5A3576 100%); color: white; padding: 30px;">
                <h1 style="margin: 0;">Purchase Order</h1>
                <h2 style="margin: 10px 0 0 0; font-weight: normal;">${po.po_number}</h2>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Dear ${po.contractor.contact_name || po.contractor.name},
                </p>
                
                <p style="color: #666; line-height: 1.6;">
                  Please find attached Purchase Order <strong>${po.po_number}</strong> from CRT Property Investments Ltd.
                </p>
                
                <div style="background: white; border-left: 4px solid #6B4190; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #6B4190;">Order Summary</h3>
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 6px 0; color: #666;">PO Number:</td>
                      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #666;">Description:</td>
                      <td style="padding: 6px 0; text-align: right;">${po.description.substring(0, 50)}...</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #666;">Amount (inc VAT):</td>
                      <td style="padding: 6px 0; text-align: right; font-size: 18px; color: #6B4190; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #fff8e1; border: 1px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #f59e0b; font-weight: bold;">⚠️ Important</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    Please quote PO number <strong>${po.po_number}</strong> on all invoices and correspondence.
                  </p>
                </div>
                
                ${pdfUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${pdfUrl}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    📄 Download Purchase Order PDF
                  </a>
                </div>
                ` : ''}
                
                <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                  If you have any questions, please contact ${po.created_by.full_name} at ${po.created_by.email}.
                </p>
                
                <p style="color: #666; margin-top: 20px;">
                  Best regards,<br>
                  <strong>CRT Property Investments Ltd</strong>
                </p>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB<br>
                www.crtproperty.co.uk</p>
              </div>
            </div>
          `,
        });
        break;

      case 'po_approved_accounts':
        // Get PDF storage path or generate if not exists
        let accountsPdfPath = po.pdf_url;
        if (!accountsPdfPath) {
          const pdfResponse = await supabase.functions.invoke('generate-po-pdf', {
            body: { po_id: po.id }
          });
          accountsPdfPath = pdfResponse.data?.pdf_url;
        }
        
        // Generate signed URL from storage path
        const accountsPdfUrl = await getSignedPdfUrl(accountsPdfPath);

        // Send to all ACCOUNTS/ADMIN users
        const accountsRecipients = accountsAdminUsers.length > 0 
          ? accountsAdminUsers.map(u => u.email) 
          : [accountsEmail];
        
        console.log(`Sending PO approved to accounts to ${accountsRecipients.length} recipient(s):`, accountsRecipients);

        emailResult = await resend.emails.send({
          from: formatFromEmail(accountsEmail, 'CRT Property Approvals'),
          to: accountsRecipients,
          subject: `PO Approved: ${po.po_number} - ${formatCurrency(Number(po.amount_inc_vat))} - ${po.contractor.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #10b981; color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">✓ Purchase Order Approved</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Ready for Invoice Upload</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  A new purchase order has been approved and is ready for invoice processing:
                </p>
                
                <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount (inc VAT):</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #10b981; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                    ${po.property ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Property:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.property.name}</td>
                    </tr>
                    ` : `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Property:</strong></td>
                      <td style="padding: 8px 0; text-align: right;"><em>N/A</em></td>
                    </tr>
                    `}
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Approved by:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.approved_by.full_name} on ${formatDate(po.approval_date)}</td>
                    </tr>
                  </table>
                </div>
                
                ${accountsPdfUrl ? `
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${accountsPdfUrl}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    📄 Download Purchase Order PDF
                  </a>
                </div>
                ` : ''}
                
                <div style="background: #e0f2fe; border: 1px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #0369a1; font-weight: bold;">📋 Next Step</p>
                  <p style="margin: 10px 0 0 0; color: #0369a1; font-size: 14px;">
                    When you receive an invoice from the contractor, upload it and match it against this PO.
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/invoices?upload_for_po=${po.id}" 
                     style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Upload Invoice for this PO
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'po_rejected':
        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: [po.created_by.email],
          subject: `PO Rejected: ${po.po_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Purchase Order Rejected</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Hi ${po.created_by.full_name},
                </p>
                
                <p style="color: #666;">
                  Your purchase order has been rejected:
                </p>
                
                <div style="background: white; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 6px 0; color: #666;">PO Number:</td>
                      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #666;">Contractor:</td>
                      <td style="padding: 6px 0; text-align: right;">${po.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #666;">Amount:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #fee; border: 1px solid #fcc; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-weight: bold; color: #dc2626;">Rejection Reason:</p>
                  <p style="margin: 10px 0 0 0; color: #666;">${po.rejection_reason}</p>
                </div>
                
                <p style="color: #666; margin: 20px 0;">
                  You can edit and resubmit this PO from the PO Hub.
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/pos/${po.id}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Edit Purchase Order
                  </a>
                </div>
              </div>
            </div>
          `,
        });
        break;

      case 'po_approved_pm':
        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: [po.created_by.email],
          subject: `PO Approved: ${po.po_number} - ${formatCurrency(Number(po.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">✓ Purchase Order Approved</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your PO has been approved</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Hi ${po.created_by.full_name},
                </p>
                
                <p style="color: #666; line-height: 1.6;">
                  Great news! Your purchase order has been approved and sent to the contractor.
                </p>
                
                <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount (inc VAT):</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #10b981; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                    ${po.property ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Property:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.property.name}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Approved by:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.approved_by.full_name} on ${formatDate(po.approval_date)}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #15803d; font-weight: bold;">✓ Next Steps</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    The contractor has been sent the purchase order. They will begin work and submit an invoice when complete.
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/pos/${po.id}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Purchase Order
                  </a>
                </div>
                
                <p style="color: #666; margin-top: 30px; line-height: 1.6;">
                  Best regards,<br>
                  <strong>CRT Property Investments Ltd</strong>
                </p>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'po_ceo_approval_request':
        // Get CEO recipients or fallback to MD email
        const ceoRecipients = ceoUsers.length > 0 
          ? ceoUsers.map(u => u.email) 
          : [mdEmail];
        
        console.log(`Sending PO CEO approval request to ${ceoRecipients.length} recipient(s):`, ceoRecipients);

        // Fetch the MD approval log to show who approved it
        const { data: mdApprovalLog } = await supabase
          .from('po_approval_logs')
          .select('*, action_by:users!po_approval_logs_action_by_user_id_fkey(full_name)')
          .eq('po_id', po.id)
          .eq('action', 'APPROVED')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const mdApproverName = mdApprovalLog?.action_by?.full_name || 'MD/Admin';
        const mdApprovalDate = mdApprovalLog?.created_at 
          ? formatDate(mdApprovalLog.created_at) 
          : 'Recently';
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: ceoRecipients,
          subject: `High-Value PO Requires CEO Approval: ${po.po_number} - ${formatCurrency(Number(po.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">High-Value Purchase Order</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Requires CEO Approval</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <!-- MD Approval Banner -->
                <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                  <p style="margin: 0; color: #059669; font-weight: bold;">✓ Reviewed & Approved by MD/Admin</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    This PO has been reviewed and approved by <strong>${mdApproverName}</strong> on ${mdApprovalDate}
                  </p>
                </div>

                <div style="background: #fff8e1; border: 1px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                  <p style="margin: 0; color: #f59e0b; font-weight: bold;">⚠️ High-Value Approval Required</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    This PO exceeds the standard approval threshold and requires your final approval.
                  </p>
                </div>
                
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  This purchase order requires your final approval:
                </p>
                
                <div style="background: white; border-left: 4px solid #f97316; padding: 20px; margin-bottom: 20px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${po.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #f97316; font-weight: bold;">${formatCurrency(Number(po.amount_inc_vat))}</td>
                    </tr>
                    ${po.property ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Property:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${po.property.name}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>MD Approval:</strong></td>
                      <td style="padding: 8px 0; text-align: right; color: #059669;">✓ ${mdApproverName} (${mdApprovalDate})</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666;"><strong>Description:</strong></p>
                  <p style="margin: 10px 0 0 0; color: #333;">${po.description.substring(0, 200)}${po.description.length > 200 ? '...' : ''}</p>
                </div>
                
                <div style="background: #fff; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    <strong>Requested by:</strong> ${po.created_by.full_name}<br>
                    <strong>Date:</strong> ${formatDate(po.created_at)}
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/approvals" 
                     style="display: inline-block; background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View in Approvals Hub
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'invoice_needs_approval':
        if (!invoice) throw new Error('Invoice ID required for invoice_needs_approval');
        
        const poAmountMatch = Math.abs(
          (invoice.amount_inc_vat || 0) - (invoice.purchase_order?.amount_inc_vat || 0)
        );
        const amountsMatch = poAmountMatch < 0.01;

        // Get all MD/ADMIN recipients
        let invoiceApprovalRecipients = mdAdminUsers.length > 0 
          ? mdAdminUsers.map(u => u.email) 
          : [mdEmail];

        // Get active delegates for MD users
        const mdUserIds = mdAdminUsers.filter(u => true).map(u => {
          // We need to fetch the MD users with their IDs
          return null;
        });
        
        // Fetch MD user IDs
        const { data: mdUsersWithIds } = await supabase
          .from('users')
          .select('id, email')
          .eq('organisation_id', invoice.organisation_id)
          .eq('role', 'MD')
          .eq('is_active', true);

        if (mdUsersWithIds && mdUsersWithIds.length > 0) {
          // Fetch active delegations for these MDs
          const { data: activeDelegationsData } = await supabase
            .from('approval_delegations')
            .select('delegate_user_id, starts_at, ends_at')
            .in('delegator_user_id', mdUsersWithIds.map(u => u.id))
            .eq('scope', 'PO_APPROVAL')
            .eq('is_active', true);

          // Filter for currently active delegations (time-wise)
          const nowDate = new Date();
          const currentlyActiveDelegations = (activeDelegationsData || []).filter(d => {
            const startsAt = d.starts_at ? new Date(d.starts_at) : null;
            const endsAt = d.ends_at ? new Date(d.ends_at) : null;
            return (!startsAt || nowDate >= startsAt) && (!endsAt || nowDate <= endsAt);
          });

          if (currentlyActiveDelegations.length > 0) {
            // Get delegate emails
            const { data: delegateUsers } = await supabase
              .from('users')
              .select('email')
              .in('id', currentlyActiveDelegations.map(d => d.delegate_user_id))
              .eq('is_active', true);

            if (delegateUsers && delegateUsers.length > 0) {
              // Add delegate emails to recipients (deduplicated)
              const allEmails = [
                ...invoiceApprovalRecipients,
                ...delegateUsers.map(u => u.email)
              ];
              invoiceApprovalRecipients = [...new Set(allEmails)];
              console.log(`Added ${delegateUsers.length} active delegate(s) to invoice approval email recipients`);
            }
          }
        }
        
        console.log(`Sending invoice approval request to ${invoiceApprovalRecipients.length} recipient(s):`, invoiceApprovalRecipients);

        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: invoiceApprovalRecipients,
          subject: `Invoice Requires Approval: ${invoice.invoice_number} - ${formatCurrency(Number(invoice.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6B4190 0%, #5A3576 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Invoice Approval Required</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Matched to Purchase Order</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  An invoice has been matched to a PO and requires your approval:
                </p>
                
                <div style="background: white; border-left: 4px solid #6B4190; padding: 20px; margin-bottom: 20px;">
                  <h3 style="margin: 0 0 15px 0; color: #6B4190;">Invoice Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Date:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${formatDate(invoice.invoice_date)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${invoice.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Amount:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #6B4190; font-weight: bold;">${formatCurrency(Number(invoice.amount_inc_vat))}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: white; border-left: 4px solid #94a3b8; padding: 20px; margin-bottom: 20px;">
                  <h3 style="margin: 0 0 15px 0; color: #64748b;">Matched Purchase Order</h3>
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 6px 0; color: #666;">PO Number:</td>
                      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoice.purchase_order.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #666;">PO Amount:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold;">${formatCurrency(Number(invoice.purchase_order.amount_inc_vat))}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: ${amountsMatch ? '#f0fdf4' : '#fff8e1'}; border: 1px solid ${amountsMatch ? '#86efac' : '#f59e0b'}; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: ${amountsMatch ? '#15803d' : '#f59e0b'}; font-weight: bold;">
                    ${amountsMatch ? '✓ Amounts Match' : '⚠️ Amount Difference'}
                  </p>
                  ${!amountsMatch ? `
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    Difference: ${formatCurrency(Math.abs(poAmountMatch))}
                  </p>
                  ` : ''}
                  ${invoice.mismatch_notes ? `
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    <strong>Note:</strong> ${invoice.mismatch_notes}
                  </p>
                  ` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/approvals" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Review in Approvals Hub
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'invoice_approved_accounts':
        if (!invoice) throw new Error('Invoice ID required for invoice_approved_accounts');
        
        // Send to all ACCOUNTS/ADMIN users (consistent with po_approved_accounts behavior)
        const invoiceAccountsRecipients = accountsAdminUsers.length > 0 
          ? accountsAdminUsers.map(u => u.email) 
          : [accountsEmail];
        
        console.log(`Sending invoice_approved_accounts to ${invoiceAccountsRecipients.length} recipient(s):`, invoiceAccountsRecipients);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(accountsEmail, 'CRT Property Approvals'),
          to: invoiceAccountsRecipients,
          subject: `Invoice Approved for Payment: ${invoice.invoice_number} - ${formatCurrency(Number(invoice.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #10b981; color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">✓ Invoice Approved for Payment</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  An invoice has been approved for payment:
                </p>
                
                <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace;">${invoice.purchase_order.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${invoice.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount (inc VAT):</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #10b981; font-weight: bold;">${formatCurrency(Number(invoice.amount_inc_vat))}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Approved by:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${invoice.approved_by.full_name}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #15803d; font-weight: bold;">✓ Ready to Process Payment</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    This invoice is now approved and ready for payment processing.
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/invoice/${invoice.id}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Invoice
                  </a>
                </div>
              </div>
            </div>
          `,
        });
        break;

      case 'invoice_approved_pm':
        if (!invoice) throw new Error('Invoice ID required for invoice_approved_pm');
        if (!invoice.purchase_order?.created_by?.email) {
          throw new Error('Cannot send invoice_approved_pm email: PO creator email not found');
        }
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: [invoice.purchase_order.created_by.email],
          subject: `Invoice Approved: ${invoice.invoice_number} for PO ${invoice.purchase_order.po_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">✓ Invoice Approved</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your PO invoice has been approved for payment</p>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  Hi ${invoice.purchase_order.created_by.full_name},
                </p>
                
                <p style="color: #666; line-height: 1.6;">
                  The invoice for your purchase order has been approved for payment.
                </p>
                
                <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace;">${invoice.purchase_order.po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${invoice.contractor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #10b981; font-weight: bold;">${formatCurrency(Number(invoice.amount_inc_vat))}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #15803d; font-weight: bold;">✓ Payment Processing</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    The accounts team will process payment according to agreed terms.
                  </p>
                </div>
                
                <p style="color: #666; margin-top: 30px; line-height: 1.6;">
                  Best regards,<br>
                  <strong>CRT Property Investments Ltd</strong>
                </p>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'invoice_rejected':
        if (!invoice) throw new Error('Invoice ID required for invoice_rejected');
        
        // Get rejection details from the latest approval log
        const { data: rejectionLog } = await supabase
          .from('invoice_approval_logs')
          .select('*, action_by:users!action_by_user_id(*)')
          .eq('invoice_id', invoice.id)
          .eq('action', 'REJECTED')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        const rejectorName = rejectionLog?.action_by?.full_name || 'An MD';
        const rejectionReason = invoice.rejection_reason || rejectionLog?.comment || 'No reason provided';
        
        // Send to all ACCOUNTS/ADMIN users + the invoice uploader
        const rejectionRecipients = accountsAdminUsers.length > 0 
          ? accountsAdminUsers.map(u => u.email) 
          : [accountsEmail];
        
        // Also notify the uploader if not already in the recipient list
        if (invoice.uploaded_by?.email && !rejectionRecipients.includes(invoice.uploaded_by.email)) {
          rejectionRecipients.push(invoice.uploaded_by.email);
        }
        
        console.log(`Sending invoice_rejected to ${rejectionRecipients.length} recipient(s):`, rejectionRecipients);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(mdEmail, 'CRT Property Approvals'),
          to: rejectionRecipients,
          subject: `Invoice Rejected: ${invoice.invoice_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">✗ Invoice Rejected</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  An invoice has been rejected and requires attention:
                </p>
                
                <div style="background: white; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoice.invoice_number}</td>
                    </tr>
                    ${invoice.purchase_order ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace;">${invoice.purchase_order.po_number}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${invoice.contractor?.name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount (inc VAT):</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #dc2626; font-weight: bold;">${formatCurrency(Number(invoice.amount_inc_vat))}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Rejected by:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${rejectorName}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #dc2626; font-weight: bold;">Rejection Reason:</p>
                  <p style="margin: 10px 0 0 0; color: #333;">
                    ${rejectionReason}
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/invoice/${invoice.id}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Invoice Details
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'invoice_paid':
        if (!invoice) throw new Error('Invoice ID required for invoice_paid');
        
        // Get payment details from the invoice
        const paymentDate = invoice.payment_date ? formatDate(invoice.payment_date) : formatDate(new Date().toISOString());
        const paymentRef = invoice.payment_reference || 'Not specified';
        
        // Build recipients list: PM (PO creator) + all ADMIN users
        const paidNotificationRecipients: string[] = [];
        
        // Add PM (the person who created the PO)
        if (invoice.purchase_order?.created_by?.email) {
          paidNotificationRecipients.push(invoice.purchase_order.created_by.email);
        }
        
        // Get ADMIN users from the organisation
        const { data: paidAdminUsers } = await supabase
          .from('users')
          .select('email')
          .eq('organisation_id', invoice.organisation_id)
          .eq('role', 'ADMIN')
          .eq('is_active', true);
        
        // Add all ADMIN users (excluding those already added)
        (paidAdminUsers || []).filter((u: { email: string }) => u.email && !paidNotificationRecipients.includes(u.email))
          .forEach((u: { email: string }) => paidNotificationRecipients.push(u.email));
        
        if (paidNotificationRecipients.length === 0) {
          console.log('No recipients found for invoice_paid notification, using fallback');
          paidNotificationRecipients.push(accountsEmail);
        }
        
        console.log(`Sending invoice_paid to ${paidNotificationRecipients.length} recipient(s):`, paidNotificationRecipients);
        
        emailResult = await resend.emails.send({
          from: formatFromEmail(accountsEmail, 'CRT Property Accounts'),
          to: paidNotificationRecipients,
          subject: `Invoice Paid: ${invoice.invoice_number} - ${formatCurrency(Number(invoice.amount_inc_vat))}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">✓ Payment Complete</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #333;">
                  An invoice has been marked as paid:
                </p>
                
                <div style="background: white; border-left: 4px solid #059669; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${invoice.invoice_number}</td>
                    </tr>
                    ${invoice.purchase_order ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-family: monospace;">${invoice.purchase_order.po_number}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Contractor:</strong></td>
                      <td style="padding: 8px 0; text-align: right;">${invoice.contractor?.name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Amount Paid:</strong></td>
                      <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #059669; font-weight: bold;">${formatCurrency(Number(invoice.amount_inc_vat))}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #059669; font-weight: bold;">Payment Details:</p>
                  <table style="width: 100%; margin-top: 10px;">
                    <tr>
                      <td style="padding: 4px 0; color: #666;">Payment Date:</td>
                      <td style="padding: 4px 0; text-align: right;">${paymentDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #666;">Reference:</td>
                      <td style="padding: 4px 0; text-align: right;">${paymentRef}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${appUrl}/invoice/${invoice.id}" 
                     style="display: inline-block; background: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Invoice Details
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>CRT Property Investments Ltd<br>
                1 Waterside Park, Valley Way, Wombwell, Barnsley, S73 0BB</p>
              </div>
            </div>
          `,
        });
        break;

      case 'user_invitation':
        if (!invitation) {
          throw new Error('Invitation data required for user_invitation email');
        }

        const signupUrl = `${appUrl}/login`;
        const roleDisplayName = invitation.role === 'PROPERTY_MANAGER' ? 'Property Manager' :
                                invitation.role === 'MD' ? 'Managing Director' :
                                invitation.role === 'ACCOUNTS' ? 'Accounts' :
                                invitation.role === 'ADMIN' ? 'Administrator' : invitation.role;

        emailResult = await resend.emails.send({
          from: formatFromEmail(accountsEmail, 'CRT Property Approvals'),
          to: [invitation.email],
          subject: `You're invited to join ${invitation.organisation.name}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #6B4190 0%, #5A3576 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background-color: #6B4190; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                  .info-box { background-color: white; padding: 15px; border-left: 4px solid #6B4190; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">You're Invited!</h1>
                  </div>
                  <div class="content">
                    <p>Hello ${invitation.full_name},</p>
                    
                    <p><strong>${invitation.invited_by.full_name}</strong> has invited you to join <strong>${invitation.organisation.name}</strong> on the Purchase Order Management System.</p>
                    
                    <div class="info-box">
                      <p style="margin: 5px 0;"><strong>Your Role:</strong> ${roleDisplayName}</p>
                      <p style="margin: 5px 0;"><strong>Organisation:</strong> ${invitation.organisation.name}</p>
                    </div>
                    
                    <p>Click the button below to create your account and get started:</p>
                    
                    <div style="text-align: center;">
                      <a href="${signupUrl}" class="button" style="color: white !important; text-decoration: none;">Accept Invitation & Sign Up</a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px;">
                      <strong>Important:</strong> This invitation will expire in 7 days. 
                      When you sign up, please use the email address <strong>${invitation.email}</strong> to ensure your role is correctly assigned.
                    </p>
                    
                    <p>If you have any questions, please contact ${invitation.invited_by.full_name} at ${invitation.invited_by.email}.</p>
                  </div>
                  <div class="footer">
                    <p>This invitation was sent by ${invitation.organisation.name}</p>
                    <p>If you did not expect this invitation, you can safely ignore this email.</p>
                  </div>
                </div>
              </body>
            </html>
          `
        });
        console.log('User invitation email sent successfully');
        break;

      default:
        throw new Error('Invalid email type');
    }

    console.log('Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult.data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
