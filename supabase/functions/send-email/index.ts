import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'po_approval_request' | 'po_approved_contractor' | 'po_approved_accounts' | 'po_approved_pm' | 'po_rejected' | 'invoice_needs_approval' | 'invoice_approved_accounts' | 'invoice_approved_pm' | 'user_invitation';
  po_id?: string;
  invoice_id?: string;
  invitation_id?: string;
  template?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, po_id, invoice_id, invitation_id }: EmailRequest = await req.json();

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

    // Get email settings
    const { data: settings } = await supabase
      .from('settings')
      .select('notify_md_email, contractor_email, notify_pm_email, notify_accounts_email')
      .eq('organisation_id', po?.organisation_id || invoice?.organisation_id || invitation?.organisation_id)
      .single();

    // Get organisation for default notification email (accounts_email)
    let defaultNotificationEmail = 'accounts@crtproperty.co.uk';
    if (po?.organisation_id || invoice?.organisation_id || invitation?.organisation_id) {
      const { data: org } = await supabase
        .from('organisations')
        .select('accounts_email')
        .eq('id', po?.organisation_id || invoice?.organisation_id || invitation?.organisation_id)
        .single();
      
      if (org?.accounts_email) {
        defaultNotificationEmail = org.accounts_email;
      }
    }

    // Fetch MD and ADMIN users for the organization
    let mdAdminUsers: { email: string; full_name: string }[] = [];
    let accountsAdminUsers: { email: string; full_name: string }[] = [];
    const orgId = po?.organisation_id || invoice?.organisation_id || invitation?.organisation_id;
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

    let emailResult;

    switch (type) {
      case 'po_approval_request':
        // Get all MD/ADMIN recipients or fallback to configured mdEmail
        const approvalRecipients = mdAdminUsers.length > 0 
          ? mdAdminUsers.map(u => u.email) 
          : [mdEmail];
        
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

      case 'po_approved_contractor':
        // Get PDF URL or generate if not exists
        let pdfUrl = po.pdf_url;
        if (!pdfUrl) {
          // Trigger PDF generation
          const pdfResponse = await supabase.functions.invoke('generate-po-pdf', {
            body: { po_id: po.id }
          });
          pdfUrl = pdfResponse.data?.pdf_url;
        }

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
        // Get PDF URL or generate if not exists
        let accountsPdfUrl = po.pdf_url;
        if (!accountsPdfUrl) {
          const pdfResponse = await supabase.functions.invoke('generate-po-pdf', {
            body: { po_id: po.id }
          });
          accountsPdfUrl = pdfResponse.data?.pdf_url;
        }

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

      case 'invoice_needs_approval':
        if (!invoice) throw new Error('Invoice ID required for invoice_needs_approval');
        
        const poAmountMatch = Math.abs(
          (invoice.amount_inc_vat || 0) - (invoice.purchase_order?.amount_inc_vat || 0)
        );
        const amountsMatch = poAmountMatch < 0.01;

        // Get all MD/ADMIN recipients or fallback to configured mdEmail
        const invoiceApprovalRecipients = mdAdminUsers.length > 0 
          ? mdAdminUsers.map(u => u.email) 
          : [mdEmail];
        
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
