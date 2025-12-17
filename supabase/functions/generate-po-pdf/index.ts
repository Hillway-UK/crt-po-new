import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { po_id } = await req.json();

    if (!po_id) {
      return new Response(
        JSON.stringify({ error: 'PO ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching PO data for:', po_id);

    // Fetch PO with all related data
    const { data: po, error: poError } = await supabase
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

    console.log('PO data fetched successfully');

    // Generate HTML for PDF
    const html = generatePOHtml(po);
    console.log('HTML generated, converting to PDF...');

    // Convert HTML to PDF using pdfshift.io
    
    const pdfBlob = await generatePdf(html);
    
    // Upload to Supabase Storage
    const fileName = `${po.po_number}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('po-documents')
      .upload(`pos/${fileName}`, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw uploadError;
    }

    console.log('PDF uploaded successfully');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('po-documents')
      .getPublicUrl(`pos/${fileName}`);

    const pdfUrl = urlData.publicUrl;

    // Update PO with PDF URL
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ pdf_url: pdfUrl })
      .eq('id', po_id);

    if (updateError) {
      console.error('Error updating PO:', updateError);
      throw updateError;
    }

    console.log('PO updated with PDF URL');

    return new Response(
      JSON.stringify({ pdf_url: pdfUrl, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in generate-po-pdf function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generatePOHtml(po: any): string {
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

  const vatAmount = Number(po.amount_ex_vat) * (po.vat_rate / 100);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #1a1a1a;
          padding: 40px;
        }
        .header {
          background: linear-gradient(135deg, #6B4190 0%, #5A3576 100%);
          color: white;
          padding: 30px;
          margin-bottom: 30px;
          border-radius: 8px;
        }
        .header h1 {
          font-size: 28pt;
          font-weight: 700;
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .company-info {
          font-size: 10pt;
          opacity: 0.95;
          line-height: 1.6;
        }
        .po-meta {
          background: #f8f9fa;
          padding: 20px;
          margin-bottom: 25px;
          border-left: 4px solid #6B4190;
          border-radius: 4px;
        }
        .po-meta-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .po-meta-item:last-child {
          margin-bottom: 0;
        }
        .po-meta-label {
          font-weight: 600;
          color: #666;
        }
        .po-meta-value {
          font-family: 'Courier New', monospace;
          font-weight: 600;
          color: #1a1a1a;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 12pt;
          font-weight: 700;
          color: #6B4190;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #6B4190;
        }
        .info-block {
          background: white;
          border: 1px solid #e5e7eb;
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 4px;
        }
        .info-block h3 {
          font-size: 10pt;
          color: #666;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-block p {
          color: #1a1a1a;
          margin-bottom: 4px;
        }
        .description {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .amounts-table {
          width: 100%;
          margin-top: 15px;
          border-collapse: collapse;
        }
        .amounts-table td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .amounts-table .label {
          text-align: left;
          color: #666;
        }
        .amounts-table .amount {
          text-align: right;
          font-family: 'Courier New', monospace;
          font-weight: 500;
        }
        .amounts-table .total-row {
          border-top: 3px solid #6B4190;
          border-bottom: 3px solid #6B4190;
        }
        .amounts-table .total-row td {
          padding: 15px 10px;
          font-size: 14pt;
          font-weight: 700;
        }
        .amounts-table .total-row .amount {
          color: #6B4190;
        }
        .terms {
          background: #fff8e1;
          border: 1px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .terms-title {
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 8px;
        }
        .terms p {
          font-size: 10pt;
          color: #666;
          margin-bottom: 6px;
        }
        .important {
          background: #fee;
          border: 1px solid #fcc;
          padding: 12px;
          margin-top: 10px;
          border-radius: 4px;
        }
        .important strong {
          color: #dc2626;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
        }
        .signature {
          margin-top: 30px;
          text-align: left;
        }
        .signature p {
          margin-bottom: 4px;
          color: #666;
        }
        .signature .name {
          font-weight: 700;
          color: #1a1a1a;
          font-size: 12pt;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PURCHASE ORDER</h1>
        <div class="company-info">
          <strong>CRT Property Investments Ltd</strong><br>
          1 Waterside Park, Valley Way<br>
          Wombwell, Barnsley, S73 0BB<br>
          www.crtproperty.co.uk
        </div>
      </div>

      <div class="po-meta">
        <div class="po-meta-item">
          <span class="po-meta-label">PO Number:</span>
          <span class="po-meta-value">${po.po_number}</span>
        </div>
        <div class="po-meta-item">
          <span class="po-meta-label">Date Issued:</span>
          <span class="po-meta-value">${formatDate(po.approval_date || po.created_at)}</span>
        </div>
        ${po.approved_by ? `
        <div class="po-meta-item">
          <span class="po-meta-label">Approved By:</span>
          <span class="po-meta-value">${po.approved_by.full_name}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">SUPPLIER DETAILS</div>
        <div class="info-block">
          <h3>To</h3>
          <p><strong>${po.contractor.name}</strong></p>
          ${po.contractor.contact_name ? `<p>${po.contractor.contact_name}</p>` : ''}
          ${po.contractor.address ? `<p>${po.contractor.address}</p>` : ''}
          <p>${po.contractor.email}</p>
          ${po.contractor.phone ? `<p>${po.contractor.phone}</p>` : ''}
        </div>
      </div>

      ${po.property ? `
      <div class="section">
        <div class="section-title">PROPERTY</div>
        <div class="info-block">
          <p><strong>${po.property.name}</strong></p>
          <p>${po.property.address}</p>
        </div>
      </div>
      ` : `
      <div class="section">
        <div class="section-title">PROPERTY</div>
        <div class="info-block">
          <p><em>General / Not property specific</em></p>
        </div>
      </div>
      `}

      <div class="section">
        <div class="section-title">DESCRIPTION OF WORKS/SERVICES</div>
        <div class="description">${po.description}</div>
      </div>

      ${po.notes ? `
      <div class="section">
        <div class="section-title">ADDITIONAL NOTES</div>
        <div class="description">${po.notes}</div>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">AMOUNT</div>
        <table class="amounts-table">
          <tr>
            <td class="label">Subtotal (ex VAT):</td>
            <td class="amount">${formatCurrency(Number(po.amount_ex_vat))}</td>
          </tr>
          <tr>
            <td class="label">VAT @ ${po.vat_rate}%:</td>
            <td class="amount">${formatCurrency(vatAmount)}</td>
          </tr>
          <tr class="total-row">
            <td class="label"><strong>TOTAL (inc VAT):</strong></td>
            <td class="amount">${formatCurrency(Number(po.amount_inc_vat))}</td>
          </tr>
        </table>
      </div>

      <div class="terms">
        <div class="terms-title">PAYMENT TERMS</div>
        <p>${po.organisation?.accounts_email ? `Payment to be made to: ${po.organisation.accounts_email}` : ''}</p>
        <p>${po.contractor.default_payment_terms ? `Payment due: ${po.contractor.default_payment_terms} days from invoice date` : 'Payment terms: 30 days from invoice date'}</p>
        
        <div class="important">
          <p><strong>IMPORTANT:</strong> No works should commence without this valid Purchase Order. Please quote PO number <strong>${po.po_number}</strong> on all invoices and correspondence.</p>
        </div>
      </div>

      <div class="signature">
        <p>Authorised by:</p>
        <p class="name">${po.approved_by?.full_name || 'Awaiting Approval'}</p>
        <p>Date: ${po.approval_date ? formatDate(po.approval_date) : '—'}</p>
      </div>

      <div class="footer">
        <p style="font-size: 9pt; color: #999;">
          This purchase order is issued by CRT Property Investments Ltd.<br>
          If you have any queries, please contact us at ${po.organisation?.accounts_email || 'accounts@crtproperty.co.uk'}
        </p>
      </div>
    </body>
    </html>
  `;
}

async function generatePdf(html: string): Promise<Blob> {
  const apiKey = Deno.env.get('PDFSHIFT_API_KEY');
  
  if (!apiKey) {
    console.error('PDFSHIFT_API_KEY is not configured');
    throw new Error('PDFSHIFT_API_KEY is not configured');
  }

  console.log('Generating PDF with pdfshift.io...');

  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
    },
    body: JSON.stringify({
      source: html,
      format: 'A4',
      margin: '0mm',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('pdfshift.io error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Failed to generate PDF: ${response.status} - ${errorText}`);
  }

  console.log('PDF generated successfully with pdfshift.io');
  return await response.blob();
}
