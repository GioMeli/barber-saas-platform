import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(data: any): Response {
    return new Response(
        JSON.stringify({ code: "SUCCESS", message: "ok", data }),
        {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        }
    );
}

function fail(msg: string, code = 400): Response {
    return new Response(
        JSON.stringify({ code: "FAIL", message: msg }),
        {
            status: code,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        }
    );
}

Deno.serve(async (req) => {
    try {
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }
        if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

        const request = await req.json();
        
        const { businessId, planId, successUrl, cancelUrl } = request;
        
        if (!businessId || !planId || !successUrl || !cancelUrl) {
            throw new Error("Missing required parameters");
        }

        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        const { data: { user }, error: authError } = token
            ? await supabase.auth.getUser(token)
            : { data: { user: null }, error: new Error("Unauthorized") };

        if (!user || authError) {
             throw new Error("Unauthorized");
        }

        // Verify user has access to business
        const { data: member, error: memberError } = await supabase
            .from('business_members')
            .select('role')
            .eq('business_id', businessId)
            .eq('user_id', user.id)
            .single();

        if (memberError || !member || member.role !== 'Owner') {
            throw new Error("Only business owners can manage subscriptions");
        }

        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeSecretKey) {
            throw new Error("STRIPE_SECRET_KEY is not configured");
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2025-08-27.basil", // Update api version to match required format or ignore if 2025-08-27.basil is valid
        });

        // Get or create Stripe customer
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('business_id', businessId)
            .single();

        let customerId = subscription?.stripe_customer_id;

        if (!customerId) {
            // Get business info to create customer
            const { data: business } = await supabase
                .from('businesses')
                .select('name, email')
                .eq('id', businessId)
                .single();

            const customer = await stripe.customers.create({
                name: business?.name,
                email: business?.email || user.email,
                metadata: {
                    business_id: businessId
                }
            });
            customerId = customer.id;

            // Save customer ID
            await supabase
                .from('subscriptions')
                .upsert({
                    business_id: businessId,
                    stripe_customer_id: customerId,
                    plan_id: 'free_trial',
                    status: 'trialing'
                }, { onConflict: 'business_id' });
        }

        // Map plan ID to Stripe Price ID
        const priceIds: Record<string, string> = {
            'basic': Deno.env.get("STRIPE_PRICE_BASIC") || '',
            'premium': Deno.env.get("STRIPE_PRICE_PREMIUM") || '',
        };

        const priceId = priceIds[planId];
        
        if (!priceId) {
             throw new Error(`Invalid plan or missing price ID for ${planId}`);
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                business_id: businessId,
                plan_id: planId,
                user_id: user.id
            },
        });

        return ok({
            url: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Payment processing failed", 500);
    }
});