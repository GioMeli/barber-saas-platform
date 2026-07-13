import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
    try {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
        
        if (!stripeSecretKey || !webhookSecret) {
            console.error("Missing Stripe secrets");
            return new Response("Webhook Secret not configured.", { status: 400 });
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2025-08-27.basil",
        });

        const signature = req.headers.get("Stripe-Signature");
        if (!signature) {
            return new Response("No signature", { status: 400 });
        }

        const body = await req.text();
        let event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
            console.error(`Webhook signature verification failed:`, err);
            return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}`, { status: 400 });
        }

        console.log(`Received event: ${event.type}`);

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode === "subscription") {
                    const businessId = session.metadata?.business_id;
                    const planId = session.metadata?.plan_id;
                    
                    if (businessId && planId) {
                        await supabase
                            .from('subscriptions')
                            .update({
                                stripe_subscription_id: session.subscription as string,
                                plan_id: planId,
                                status: 'active',
                            })
                            .eq('business_id', businessId);
                    }
                }
                break;
            }
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                
                await supabase
                    .from('subscriptions')
                    .update({
                        status: subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                    })
                    .eq('stripe_subscription_id', subscription.id);
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                
                await supabase
                    .from('subscriptions')
                    .update({
                        status: 'canceled',
                        plan_id: 'free_trial', // Fallback or handle differently based on requirements
                    })
                    .eq('stripe_subscription_id', subscription.id);
                break;
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Webhook handler failed:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
});