import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Billing() {
  const { businessMemberships, user } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', businessId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      toast.loading('Redirecting to checkout...', { id: 'checkout' });
      
      const { data, error } = await supabase.functions.invoke('create_subscription_checkout', {
        body: {
          businessId,
          planId,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to initiate checkout', { id: 'checkout' });
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing & Subscription</h2>
        <p className="text-muted-foreground text-sm">Manage your plan and payment methods.</p>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {subscription?.status === 'trialing' ? 'You are currently on a 14-day free trial.' : 'Manage your active subscription.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">{subscription?.plan_id.replace('_', ' ') || 'Free Trial'}</div>
          <div className="mt-4 flex gap-4">
             {subscription?.status !== 'trialing' && (
              <Button variant="outline" onClick={() => window.open('https://billing.stripe.com/p/login/test_123', '_blank')}>
                Manage Billing Portal
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <h3 className="text-xl font-bold mt-8 mb-4">Available Plan</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">PRO</div>
          <CardHeader>
            <CardTitle>Professional Plan</CardTitle>
            <CardDescription>€30 / month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Unlimited appointments</li>
              <li>• Unlimited staff members</li>
              <li>• Public booking page</li>
              <li>• Email reminders</li>
              <li>• Advanced reports & exports</li>
              <li>• Inventory management</li>
            </ul>
            <Button className="w-full" variant={subscription?.plan_id === 'premium' ? 'secondary' : 'default'} onClick={() => handleSubscribe('premium')} disabled={subscription?.plan_id === 'premium'}>
               {subscription?.plan_id === 'premium' ? 'Current Plan' : 'Subscribe for €30/mo'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}