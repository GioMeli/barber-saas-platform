import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PlatformAdmin() {
  const { profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (profile?.role !== 'Platform Admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Admin</h1>
          <p className="text-muted-foreground">Manage entire SaaS platform.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Businesses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">$0.00</div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
           <CardHeader>
              <CardTitle>Recent Businesses</CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground border-t border-border">
              Admin table implementation...
            </CardContent>
        </Card>
      </div>
    </div>
  );
}