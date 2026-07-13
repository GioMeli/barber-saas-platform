import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ImageUploader } from '@/components/ui/image-uploader';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, PackageMinus, PackagePlus } from 'lucide-react';

export default function Products() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    cost_price: '0',
    selling_price: '',
    current_stock: '0',
    min_stock: '5',
    image_url: '',
    is_active: true
  });

  // Stock Adj State
  const [stockAdj, setStockAdj] = useState({
    product_id: '',
    product_name: '',
    quantity: '1',
    type: 'purchase',
    reason: ''
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
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name,
        sku: product.sku || '',
        category: product.category || '',
        cost_price: product.cost_price.toString(),
        selling_price: product.selling_price.toString(),
        current_stock: product.current_stock.toString(),
        min_stock: product.min_stock.toString(),
        image_url: product.image_url || '',
        is_active: product.is_active
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        sku: '',
        category: '',
        cost_price: '0',
        selling_price: '',
        current_stock: '0',
        min_stock: '5',
        image_url: '',
        is_active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleOpenStockDialog = (product: any) => {
    setStockAdj({
      product_id: product.id,
      product_name: product.name,
      quantity: '1',
      type: 'purchase',
      reason: ''
    });
    setIsStockDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.selling_price) {
      toast.error('Name and selling price are required');
      return;
    }
    if (!formData.image_url) {
      toast.error('Product image is required');
      return;
    }

    try {
      const payload = {
        business_id: businessId,
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        cost_price: parseFloat(formData.cost_price),
        selling_price: parseFloat(formData.selling_price),
        current_stock: parseInt(formData.current_stock),
        min_stock: parseInt(formData.min_stock),
        image_url: formData.image_url,
        is_active: formData.is_active
      };

      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        toast.success('Product added');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product');
    }
  };

  const handleSaveStock = async () => {
    try {
      const qty = parseInt(stockAdj.quantity);
      if (qty <= 0) {
        toast.error('Quantity must be greater than 0');
        return;
      }

      const product = products.find(p => p.id === stockAdj.product_id);
      if (!product) return;

      let newStock = product.current_stock;
      if (stockAdj.type === 'purchase' || stockAdj.type === 'return') {
        newStock += qty;
      } else {
        newStock -= qty;
      }

      // Update product stock
      const { error: pError } = await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', stockAdj.product_id);

      if (pError) throw pError;

      // Record movement
      const { error: mError } = await supabase
        .from('stock_movements')
        .insert([{
          product_id: stockAdj.product_id,
          quantity: qty,
          type: stockAdj.type,
          reason: stockAdj.reason
        }]);

      if (mError) throw mError;

      toast.success('Stock adjusted');
      setIsStockDialogOpen(false);
      fetchData();

    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust stock');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Product deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground text-sm">Manage inventory and retail products.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto bg-card rounded-md">
            <Table className="[&>div]:max-w-full min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Product</TableHead>
                  <TableHead className="whitespace-nowrap">SKU</TableHead>
                  <TableHead className="whitespace-nowrap">Price</TableHead>
                  <TableHead className="whitespace-nowrap">Stock</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground whitespace-nowrap">Loading products...</TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground whitespace-nowrap">No products found.</TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded-md border border-border" />
                          ) : (
                            <div className="w-10 h-10 rounded-md border border-border bg-muted flex items-center justify-center">
                              <PackageMinus className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            {product.name}
                            {product.category && <span className="block text-xs text-muted-foreground">{product.category}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{product.sku || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">${product.selling_price.toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${product.current_stock <= product.min_stock ? 'bg-destructive/20 text-destructive' : 'bg-secondary'}`}>
                          {product.current_stock}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="Adjust Stock" onClick={() => handleOpenStockDialog(product)}>
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
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

      {/* Edit Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product Image *</Label>
              {formData.image_url ? (
                <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border group">
                  <img src={formData.image_url} alt="Product" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="ghost" size="sm" className="text-white hover:text-white" onClick={() => setFormData({...formData, image_url: ''})}>Remove</Button>
                  </div>
                </div>
              ) : (
                <ImageUploader 
                  folder={`products/${businessId}`} 
                  value={formData.image_url}
                  onChange={(url) => setFormData({...formData, image_url: url})}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="px-3" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="px-3" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="px-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cost_price">Cost Price ($)</Label>
                <Input id="cost_price" type="number" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: e.target.value})} className="px-3" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="selling_price">Selling Price ($) *</Label>
                <Input id="selling_price" type="number" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="px-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="current_stock">Current Stock</Label>
                <Input id="current_stock" type="number" value={formData.current_stock} disabled={!!editingId} onChange={(e) => setFormData({...formData, current_stock: e.target.value})} className="px-3" />
                {editingId && <p className="text-xs text-muted-foreground">Use stock adjustment for existing items</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock">Low Stock Alert At</Label>
                <Input id="min_stock" type="number" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: e.target.value})} className="px-3" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({...formData, is_active: c})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent className="sm:max-w-[425px] w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust Stock: {stockAdj.product_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="adj_type">Adjustment Type</Label>
              <select 
                id="adj_type" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={stockAdj.type}
                onChange={(e) => setStockAdj({...stockAdj, type: e.target.value})}
              >
                <option value="purchase">Add Stock (Purchase/Received)</option>
                <option value="sale">Remove Stock (Sale/Used)</option>
                <option value="damage">Remove Stock (Damage/Loss)</option>
                <option value="return">Add Stock (Customer Return)</option>
                <option value="correction">Inventory Correction (Count Adj)</option>
              </select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="adj_qty">Quantity</Label>
              <Input id="adj_qty" type="number" min="1" value={stockAdj.quantity} onChange={(e) => setStockAdj({...stockAdj, quantity: e.target.value})} className="px-3" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adj_reason">Reason/Notes (Optional)</Label>
              <Input id="adj_reason" value={stockAdj.reason} onChange={(e) => setStockAdj({...stockAdj, reason: e.target.value})} className="px-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStock}>Confirm Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}