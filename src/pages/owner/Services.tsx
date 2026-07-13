import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function Services() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '30',
    category_id: '',
    is_active: true,
    online_booking_enabled: true
  });

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        supabase.from('services').select('*, service_categories(name)').eq('business_id', businessId).order('created_at', { ascending: false }),
        supabase.from('service_categories').select('*').eq('business_id', businessId).order('name')
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setServices(servicesRes.data || []);
      setCategories(categoriesRes.data || []);
      
      if (categoriesRes.data && categoriesRes.data.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: categoriesRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (service?: any) => {
    if (service) {
      setEditingId(service.id);
      setFormData({
        name: service.name,
        description: service.description || '',
        price: service.price.toString(),
        duration: service.duration.toString(),
        category_id: service.category_id || (categories[0]?.id ?? ''),
        is_active: service.is_active,
        online_booking_enabled: service.online_booking_enabled
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        duration: '30',
        category_id: categories[0]?.id || '',
        is_active: true,
        online_booking_enabled: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.duration) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const payload = {
        business_id: businessId,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        category_id: formData.category_id || null,
        is_active: formData.is_active,
        online_booking_enabled: formData.online_booking_enabled
      };

      if (editingId) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Service updated');
      } else {
        const { error } = await supabase.from('services').insert([payload]);
        if (error) throw error;
        toast.success('Service created');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save service');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      toast.success('Service deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete service');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Services</h2>
          <p className="text-muted-foreground text-sm">Manage your service offerings and pricing.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Service
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto bg-card rounded-md">
            <Table className="[&>div]:max-w-full min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Service Name</TableHead>
                  <TableHead className="whitespace-nowrap">Category</TableHead>
                  <TableHead className="whitespace-nowrap">Duration</TableHead>
                  <TableHead className="whitespace-nowrap">Price</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground whitespace-nowrap">Loading services...</TableCell>
                  </TableRow>
                ) : services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground whitespace-nowrap">No services found. Add your first service to get started.</TableCell>
                  </TableRow>
                ) : (
                  services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium whitespace-nowrap">{service.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{service.service_categories?.name || 'Uncategorized'}</TableCell>
                      <TableCell className="whitespace-nowrap">{service.duration} min</TableCell>
                      <TableCell className="whitespace-nowrap">${service.price.toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${service.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {service.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(service)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="px-3" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price ($) *</Label>
                <Input id="price" type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="px-3" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (mins) *</Label>
                <Input id="duration" type="number" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} className="px-3" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <select 
                id="category" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
              >
                <option value="">No Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="px-3" />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-sm text-muted-foreground">Make this service available.</p>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({...formData, is_active: c})} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>Online Booking</Label>
                <p className="text-sm text-muted-foreground">Allow customers to book online.</p>
              </div>
              <Switch checked={formData.online_booking_enabled} onCheckedChange={(c) => setFormData({...formData, online_booking_enabled: c})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}