import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date().toISOString();
    
    console.log(`Checking for expired delegations at ${now}`);
    
    // Find expired delegations that are still active
    const { data: expiredDelegations, error: fetchError } = await supabase
      .from('approval_delegations')
      .select(`
        id, 
        delegator_user_id, 
        delegate_user_id, 
        ends_at,
        delegate:users!approval_delegations_delegate_user_id_fkey(organisation_id)
      `)
      .eq('is_active', true)
      .not('ends_at', 'is', null)
      .lt('ends_at', now);

    if (fetchError) {
      console.error('Error fetching expired delegations:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredDelegations?.length || 0} expired delegations to deactivate`);

    if (expiredDelegations && expiredDelegations.length > 0) {
      const expiredIds = expiredDelegations.map(d => d.id);
      
      // Deactivate all expired delegations
      const { error: updateError } = await supabase
        .from('approval_delegations')
        .update({ is_active: false, updated_at: now })
        .in('id', expiredIds);

      if (updateError) {
        console.error('Error updating delegations:', updateError);
        throw updateError;
      }

      console.log(`Successfully deactivated ${expiredIds.length} delegations`);
      
      // Send notifications to delegates that their delegation has ended
      for (const delegation of expiredDelegations) {
        const organisationId = (delegation.delegate as any)?.organisation_id;
        
        if (organisationId) {
          // Send in-app notification
          const { error: notifyError } = await supabase.from('notifications').insert({
            user_id: delegation.delegate_user_id,
            organisation_id: organisationId,
            title: 'Delegation Period Ended',
            message: 'Your approval delegation has expired. You can no longer approve POs on behalf of the MD.',
            type: 'delegation_expired',
            link: '/approvals',
          });
          
          if (notifyError) {
            console.error(`Error sending notification to ${delegation.delegate_user_id}:`, notifyError);
          } else {
            console.log(`Sent expiry notification to delegate ${delegation.delegate_user_id}`);
          }

          // Send email notification
          try {
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                type: 'delegation_expired',
                delegation_id: delegation.id,
              }),
            });
            
            if (!emailResponse.ok) {
              console.error(`Failed to send expiry email for delegation ${delegation.id}`);
            } else {
              console.log(`Sent expiry email for delegation ${delegation.id}`);
            }
          } catch (emailError) {
            console.error(`Error sending expiry email for delegation ${delegation.id}:`, emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deactivated: expiredDelegations?.length || 0,
        timestamp: now
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in deactivate-expired-delegations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
