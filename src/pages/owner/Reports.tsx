import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DollarSign, Calendar, Users, Package, Scissors, UserCircle } from 'lucide-react';

export default function Reports() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [metrics, setMetrics] = useState({
    revenue: 0,
    appointments: 0,
    newCustomers: 0,
    productsSold: 0
  });

  const [topServices, setTopServices] = useState<any[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startIso = new Date(dateRange.start).toISOString();
      const endIso = new Date(new Date(dateRange.end).getTime() + 86400000).toISOString();

      // Fetch Appointments for staff and services
      const { data: apptsData, error: apptsError } = await supabase
        .from('appointments')
        .select('id, total_price, status, employee_id, employees(name), appointment_services(services(id, name, price))')
        .eq('business_id', businessId)
        .gte('start_time', startIso)
        .lt('start_time', endIso)
        .in('status', ['completed', 'confirmed', 'in_progress']);

      if (apptsError) throw apptsError;

      // Fetch Customers
      const { count: newCustCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', startIso)
        .lt('created_at', endIso);

      // Fetch Stock Movements for products sold
      const { data: stockData } = await supabase
        .from('stock_movements')
        .select('quantity, products!inner(business_id, name)')
        .eq('products.business_id', businessId)
        .eq('type', 'out')
        .gte('created_at', startIso)
        .lt('created_at', endIso);

      const appts = apptsData || [];
      const totalRev = appts.reduce((sum, a) => sum + Number(a.total_price || 0), 0);
      
      // Calculate Staff Performance
      const staffMap: Record<string, { name: string, revenue: number, count: number }> = {};
      appts.forEach((a: any) => {
        const empName = a.employees?.name || 'Unassigned';
        if (!staffMap[empName]) staffMap[empName] = { name: empName, revenue: 0, count: 0 };
        staffMap[empName].revenue += Number(a.total_price || 0);
        staffMap[empName].count += 1;
      });

      const staffArray = Object.values(staffMap).sort((a, b) => b.revenue - a.revenue);

      // Calculate Top Services
      const serviceMap: Record<string, { name: string, count: number, revenue: number }> = {};
      appts.forEach((a: any) => {
        a.appointment_services?.forEach((as: any) => {
          const s = as.services;
          if (s) {
            if (!serviceMap[s.id]) serviceMap[s.id] = { name: s.name, count: 0, revenue: 0 };
            serviceMap[s.id].count += 1;
            serviceMap[s.id].revenue += Number(s.price || 0);
          }
        });
      });
      const servicesArray = Object.values(serviceMap).sort((a, b) => b.count - a.count).slice(0, 10);

      // Calculate Top Products
      const stock = stockData || [];
      let totalProductsSold = 0;
      const productMap: Record<string, { name: string, quantity: number }> = {};
      
      stock.forEach((m: any) => {
        const pName = m.products?.name || 'Unknown';
        const q = Math.abs(m.quantity || 0); // usually out movements might be stored as negative or positive
        totalProductsSold += q;
        if (!productMap[pName]) productMap[pName] = { name: pName, quantity: 0 };
        productMap[pName].quantity += q;
      });
      const productsArray = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

      setMetrics({
        revenue: totalRev,
        appointments: appts.length,
        newCustomers: newCustCount || 0,
        productsSold: totalProductsSold
      });

      setStaffPerformance(staffArray);
      setTopServices(servicesArray);
      setTopProducts(productsArray);

    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Total Revenue,$${metrics.revenue.toFixed(2)}\n`
      + `Total Appointments,${metrics.appointments}\n`
      + `New Customers,${metrics.newCustomers}\n`
      + `Products Sold,${metrics.productsSold}\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report_${dateRange.start}_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground text-sm">Analyze your business performance.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <input 
            type="date" 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateRange.start}
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
          />
          <span className="text-muted-foreground">to</span>
           <input 
            type="date" 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateRange.end}
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
          />
          <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading reports...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.revenue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Appointments</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.appointments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">New Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.newCustomers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Products Sold</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.productsSold}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Top Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-primary" /> Top Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data available.</p>
                ) : (
                  <div className="space-y-4">
                    {topServices.map((s, i) => (
                      <div key={i} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{s.name}</span>
                          <span className="font-bold text-sm">${s.revenue.toFixed(2)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{s.count} bookings</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Staff Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-primary" /> Staff Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {staffPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data available.</p>
                ) : (
                  <div className="space-y-4">
                    {staffPerformance.map((staff, i) => (
                      <div key={i} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{staff.name}</span>
                          <span className="font-bold text-sm">${staff.revenue.toFixed(2)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{staff.count} appointments completed</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" /> Products Sold
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products sold in this period.</p>
                ) : (
                  <div className="space-y-4">
                    {topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                        <span className="font-semibold text-sm">{p.name}</span>
                        <span className="text-sm font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                          {p.quantity} sold
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}