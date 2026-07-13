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
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function Staff() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    is_active: true,
    inactive_start_date: '',
    inactive_end_date: ''
  });

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (employee?: any) => {
    if (employee) {
      setEditingId(employee.id);
      setFormData({
        name: employee.name,
        email: employee.email || '',
        phone: employee.phone || '',
        is_active: employee.is_active,
        inactive_start_date: employee.inactive_start_date || '',
        inactive_end_date: employee.inactive_end_date || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        is_active: true,
        inactive_start_date: '',
        inactive_end_date: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    try {
      const payload = {
        business_id: businessId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        is_active: formData.is_active,
        inactive_start_date: formData.inactive_start_date || null,
        inactive_end_date: formData.inactive_end_date || null
      };

      if (editingId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Staff member updated');
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        toast.success('Staff member added');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save staff member');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      toast.success('Staff member removed');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove staff member');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff</h2>
          <p className="text-muted-foreground text-sm">Manage your team and their schedules.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto bg-card rounded-md">
            <Table className="[&>div]:max-w-full min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Phone</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground whitespace-nowrap">Loading staff...</TableCell>
                  </TableRow>
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground whitespace-nowrap">No staff members found.</TableCell>
                  </TableRow>
                ) : (
                  staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium whitespace-nowrap">{member.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{member.email || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{member.phone || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {member.inactive_start_date && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Away: {new Date(member.inactive_start_date).toLocaleDateString()} - {member.inactive_end_date ? new Date(member.inactive_end_date).toLocaleDateString() : 'Indefinite'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(member)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(member.id)}>
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
        <DialogContent className="sm:max-w-[425px] w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="px-3" />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="px-3" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="px-3" />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-sm text-muted-foreground">Can receive bookings.</p>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({...formData, is_active: c})} />
            </div>

            <div className="pt-4 border-t border-border mt-2 space-y-4">
              <div className="space-y-0.5">
                <Label>Temporary Inactive Period</Label>
                <p className="text-sm text-muted-foreground">Set a date range (e.g. vacation) when this staff cannot be booked.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="inactive_start_date">Start Date</Label>
                  <Input id="inactive_start_date" type="date" value={formData.inactive_start_date} onChange={(e) => setFormData({...formData, inactive_start_date: e.target.value})} className="px-3" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="inactive_end_date">End Date</Label>
                  <Input id="inactive_end_date" type="date" value={formData.inactive_end_date} onChange={(e) => setFormData({...formData, inactive_end_date: e.target.value})} className="px-3" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}