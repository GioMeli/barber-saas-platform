import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ImageUploader } from '@/components/ui/image-uploader';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Edit,
  Euro,
  History,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  TrendingDown,
} from 'lucide-react';

type InventoryTab = 'products' | 'movements' | 'alerts';
type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'damage'
  | 'return'
  | 'correction'
  | 'internal_use'
  | 'expired';

const EMPTY_FORM = {
  name: '',
  sku: '',
  barcode: '',
  brand: '',
  category: '',
  supplier_name: '',
  cost_price: '0',
  selling_price: '',
  current_stock: '0',
  min_stock: '5',
  image_url: '',
  is_active: true,
};

export default function Products() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InventoryTab>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [stockAdj, setStockAdj] = useState({
    product_id: '',
    product_name: '',
    quantity: '1',
    type: 'purchase' as StockMovementType,
    reason: '',
  });

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [productsResult, movementsResult] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('business_id', businessId)
          .order('name'),

        supabase
          .from('stock_movements')
          .select(
            'id, product_id, quantity, type, reason, created_at, products(id, name, sku, image_url, business_id)'
          )
          .eq('products.business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      setProducts(productsResult.data ?? []);
      setMovements(movementsResult.data ?? []);
    } catch (error: any) {
      console.error('Inventory loading error:', error);
      toast.error(error.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter(Boolean)
            .map(String)
        )
      ).sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        categoryFilter === 'all' || product.category === categoryFilter;

      const matchesSearch =
        !normalized ||
        [
          product.name,
          product.sku,
          product.barcode,
          product.brand,
          product.category,
          product.supplier_name,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalized)
          );

      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, categoryFilter]);

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.is_active &&
          Number(product.current_stock || 0) <=
            Number(product.min_stock || 0)
      ),
    [products]
  );

  const outOfStockProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.is_active && Number(product.current_stock || 0) <= 0
      ),
    [products]
  );

  const stockValue = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum +
          Number(product.current_stock || 0) *
            Number(product.cost_price || 0),
        0
      ),
    [products]
  );

  const retailValue = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum +
          Number(product.current_stock || 0) *
            Number(product.selling_price || 0),
        0
      ),
    [products]
  );

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name ?? '',
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        brand: product.brand ?? '',
        category: product.category ?? '',
        supplier_name: product.supplier_name ?? '',
        cost_price: String(product.cost_price ?? 0),
        selling_price: String(product.selling_price ?? ''),
        current_stock: String(product.current_stock ?? 0),
        min_stock: String(product.min_stock ?? 5),
        image_url: product.image_url ?? '',
        is_active: Boolean(product.is_active),
      });
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }

    setIsDialogOpen(true);
  };

  const handleOpenStockDialog = (product: any) => {
    setStockAdj({
      product_id: product.id,
      product_name: product.name,
      quantity: '1',
      type: 'purchase',
      reason: '',
    });
    setIsStockDialogOpen(true);
  };

  const handleOpenHistory = (product: any) => {
    setSelectedProduct(product);
    setIsHistoryDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    const sellingPrice = Number(formData.selling_price);
    const costPrice = Number(formData.cost_price);
    const currentStock = Number(formData.current_stock);
    const minimumStock = Number(formData.min_stock);

    if (
      Number.isNaN(sellingPrice) ||
      sellingPrice < 0 ||
      Number.isNaN(costPrice) ||
      costPrice < 0 ||
      Number.isNaN(currentStock) ||
      currentStock < 0 ||
      Number.isNaN(minimumStock) ||
      minimumStock < 0
    ) {
      toast.error('Prices and stock values must be valid positive numbers');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        business_id: businessId,
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        barcode: formData.barcode.trim() || null,
        brand: formData.brand.trim() || null,
        category: formData.category.trim() || null,
        supplier_name: formData.supplier_name.trim() || null,
        cost_price: costPrice,
        selling_price: sellingPrice,
        current_stock: editingId
          ? undefined
          : Math.floor(currentStock),
        min_stock: Math.floor(minimumStock),
        image_url: formData.image_url || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      );

      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(cleanPayload)
          .eq('id', editingId)
          .eq('business_id', businessId);

        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(cleanPayload)
          .select('id')
          .single();

        if (error) throw error;

        if (currentStock > 0) {
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert({
              product_id: data.id,
              quantity: Math.floor(currentStock),
              type: 'purchase',
              reason: 'Opening stock',
            });

          if (movementError) throw movementError;
        }

        toast.success('Product added');
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStock = async () => {
    if (!businessId) return;

    const quantity = Math.floor(Number(stockAdj.quantity));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const product = products.find(
      (item) => item.id === stockAdj.product_id
    );

    if (!product) return;

    const addsStock = ['purchase', 'return'].includes(stockAdj.type);
    const removesStock = [
      'sale',
      'damage',
      'internal_use',
      'expired',
    ].includes(stockAdj.type);

    let newStock = Number(product.current_stock || 0);

    if (addsStock) newStock += quantity;
    if (removesStock) newStock -= quantity;

    if (stockAdj.type === 'correction') {
      newStock = quantity;
    }

    if (newStock < 0) {
      toast.error('This adjustment would make stock negative');
      return;
    }

    setSaving(true);

    try {
      const { error: productError } = await supabase
        .from('products')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stockAdj.product_id)
        .eq('business_id', businessId);

      if (productError) throw productError;

      const recordedQuantity =
        stockAdj.type === 'correction'
          ? newStock - Number(product.current_stock || 0)
          : addsStock
            ? quantity
            : -quantity;

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: stockAdj.product_id,
          quantity: recordedQuantity,
          type: stockAdj.type,
          reason: stockAdj.reason.trim() || null,
        });

      if (movementError) throw movementError;

      toast.success('Stock adjusted');
      setIsStockDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: any) => {
    const confirmed = window.confirm(
      `Delete ${product.name}? Existing stock movement history may prevent deletion.`
    );

    if (!confirmed || !businessId) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Product deleted');
      await fetchData();
    } catch (error: any) {
      toast.error(
        error.message ||
          'Product cannot be deleted because inventory history exists'
      );
    }
  };

  const selectedProductMovements = useMemo(
    () =>
      selectedProduct
        ? movements.filter(
            (movement) => movement.product_id === selectedProduct.id
          )
        : [],
    [movements, selectedProduct]
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Inventory management
          </div>

          <h1 className="app-page-title">Products & Inventory</h1>

          <p className="app-page-description">
            Manage retail products, stock levels, suppliers and complete
            inventory movement history.
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Products"
          value={products.filter((product) => product.is_active).length}
          detail={`${products.length} total products`}
          icon={<PackageCheck className="h-5 w-5" />}
        />

        <MetricCard
          title="Low Stock"
          value={lowStockProducts.length}
          detail={`${outOfStockProducts.length} out of stock`}
          icon={<TrendingDown className="h-5 w-5" />}
          alert={lowStockProducts.length > 0}
        />

        <MetricCard
          title="Stock Cost Value"
          value={`€${stockValue.toFixed(2)}`}
          detail="Based on purchase cost"
          icon={<Boxes className="h-5 w-5" />}
        />

        <MetricCard
          title="Potential Retail Value"
          value={`€${retailValue.toFixed(2)}`}
          detail="Current stock at selling price"
          icon={<Euro className="h-5 w-5" />}
        />
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-card">
        <InventoryTabButton
          active={activeTab === 'products'}
          label="Products"
          icon={<Package className="h-4 w-4" />}
          onClick={() => setActiveTab('products')}
        />
        <InventoryTabButton
          active={activeTab === 'movements'}
          label="Stock Movements"
          icon={<History className="h-4 w-4" />}
          onClick={() => setActiveTab('movements')}
        />
        <InventoryTabButton
          active={activeTab === 'alerts'}
          label={`Stock Alerts (${lowStockProducts.length})`}
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => setActiveTab('alerts')}
        />
      </div>

      {activeTab === 'products' && (
        <Card className="overflow-hidden rounded-2xl shadow-card">
          <div className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search product, SKU, brand or supplier"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="h-11 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <EmptyState text="Loading inventory..." />
            ) : filteredProducts.length === 0 ? (
              <EmptyState text="No products match the selected filters." />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/35 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Product</th>
                        <th className="px-5 py-3 font-semibold">SKU / Barcode</th>
                        <th className="px-5 py-3 font-semibold">Supplier</th>
                        <th className="px-5 py-3 font-semibold">Cost</th>
                        <th className="px-5 py-3 font-semibold">Retail</th>
                        <th className="px-5 py-3 font-semibold">Stock</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-muted/25">
                          <td className="px-5 py-4">
                            <ProductIdentity product={product} />
                          </td>

                          <td className="px-5 py-4 text-muted-foreground">
                            <div>{product.sku || 'No SKU'}</div>
                            <div className="mt-1 text-xs">
                              {product.barcode || 'No barcode'}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {product.supplier_name || '—'}
                          </td>

                          <td className="px-5 py-4">
                            €{Number(product.cost_price || 0).toFixed(2)}
                          </td>

                          <td className="px-5 py-4 font-semibold">
                            €{Number(product.selling_price || 0).toFixed(2)}
                          </td>

                          <td className="px-5 py-4">
                            <StockBadge product={product} />
                          </td>

                          <td className="px-5 py-4">
                            <Badge
                              variant={product.is_active ? 'default' : 'secondary'}
                            >
                              {product.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <InventoryActions
                              product={product}
                              onAdjust={handleOpenStockDialog}
                              onHistory={handleOpenHistory}
                              onEdit={handleOpenDialog}
                              onDelete={handleDelete}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
                  {filteredProducts.map((product) => (
                    <ProductMobileCard
                      key={product.id}
                      product={product}
                      onAdjust={handleOpenStockDialog}
                      onHistory={handleOpenHistory}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'movements' && (
        <MovementHistory
          movements={movements}
          loading={loading}
        />
      )}

      {activeTab === 'alerts' && (
        <StockAlerts
          products={lowStockProducts}
          loading={loading}
          onAdjust={handleOpenStockDialog}
          onEdit={handleOpenDialog}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label>Product Image</Label>

              {formData.image_url ? (
                <div className="group relative h-36 w-36 overflow-hidden rounded-2xl border">
                  <img
                    src={formData.image_url}
                    alt="Product"
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          image_url: '',
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <ImageUploader
                  folder={`products/${businessId}`}
                  value={formData.image_url}
                  onChange={(url) =>
                    setFormData({
                      ...formData,
                      image_url: url,
                    })
                  }
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Product Name *"
                value={formData.name}
                onChange={(value) =>
                  setFormData({ ...formData, name: value })
                }
              />

              <Field
                label="Brand"
                value={formData.brand}
                onChange={(value) =>
                  setFormData({ ...formData, brand: value })
                }
              />

              <Field
                label="SKU"
                value={formData.sku}
                onChange={(value) =>
                  setFormData({ ...formData, sku: value })
                }
              />

              <Field
                label="Barcode"
                value={formData.barcode}
                onChange={(value) =>
                  setFormData({ ...formData, barcode: value })
                }
              />

              <Field
                label="Category"
                value={formData.category}
                onChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              />

              <Field
                label="Supplier"
                value={formData.supplier_name}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    supplier_name: value,
                  })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Cost Price (€)"
                type="number"
                value={formData.cost_price}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    cost_price: value,
                  })
                }
              />

              <Field
                label="Selling Price (€) *"
                type="number"
                value={formData.selling_price}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    selling_price: value,
                  })
                }
              />

              <Field
                label="Current Stock"
                type="number"
                disabled={Boolean(editingId)}
                value={formData.current_stock}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    current_stock: value,
                  })
                }
                helper={
                  editingId
                    ? 'Use stock adjustment for existing products.'
                    : 'Opening stock will create an initial movement.'
                }
              />

              <Field
                label="Low Stock Alert At"
                type="number"
                value={formData.min_stock}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    min_stock: value,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/25 p-4">
              <div>
                <Label>Active Product</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inactive products remain in inventory history.
                </p>
              </div>

              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    is_active: checked,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving...' : 'Save Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isStockDialogOpen}
        onOpenChange={setIsStockDialogOpen}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              Adjust Stock: {stockAdj.product_name}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label>Adjustment Type</Label>

              <select
                className="h-11 rounded-xl border bg-background px-3 text-sm"
                value={stockAdj.type}
                onChange={(event) =>
                  setStockAdj({
                    ...stockAdj,
                    type: event.target.value as StockMovementType,
                  })
                }
              >
                <option value="purchase">Stock In — Purchase / Received</option>
                <option value="return">Stock In — Customer Return</option>
                <option value="sale">Stock Out — Retail Sale</option>
                <option value="internal_use">Stock Out — Internal Use</option>
                <option value="damage">Stock Out — Damage / Loss</option>
                <option value="expired">Stock Out — Expired</option>
                <option value="correction">Set Exact Stock Count</option>
              </select>
            </div>

            <Field
              label={
                stockAdj.type === 'correction'
                  ? 'New Exact Stock Quantity'
                  : 'Quantity'
              }
              type="number"
              value={stockAdj.quantity}
              onChange={(value) =>
                setStockAdj({
                  ...stockAdj,
                  quantity: value,
                })
              }
            />

            <Field
              label="Reason / Notes"
              value={stockAdj.reason}
              onChange={(value) =>
                setStockAdj({
                  ...stockAdj,
                  reason: value,
                })
              }
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsStockDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={saving}
              onClick={() => void handleSaveStock()}
            >
              {saving ? 'Saving...' : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
      >
        <DialogContent className="max-h-[88vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              Stock History: {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>

          <MovementList movements={selectedProductMovements} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
  alert = false,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${
        alert
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-slate-200 bg-gradient-to-br from-white to-blue-50/50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>

          <div className="mt-3 text-3xl font-bold">{value}</div>

          <div className="mt-2 text-xs text-muted-foreground">
            {detail}
          </div>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            alert
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InventoryTabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProductIdentity({ product }: { product: any }) {
  return (
    <div className="flex items-center gap-3">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="h-12 w-12 rounded-xl border object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted">
          <PackageMinus className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate font-semibold">{product.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {[product.brand, product.category].filter(Boolean).join(' · ') ||
            'Uncategorized'}
        </div>
      </div>
    </div>
  );
}

function StockBadge({ product }: { product: any }) {
  const current = Number(product.current_stock || 0);
  const minimum = Number(product.min_stock || 0);

  if (current <= 0) {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        Out of stock
      </Badge>
    );
  }

  if (current <= minimum) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        {current} · Low
      </Badge>
    );
  }

  return <Badge variant="secondary">{current} available</Badge>;
}

function InventoryActions({
  product,
  onAdjust,
  onHistory,
  onEdit,
  onDelete,
}: any) {
  return (
    <div className="inline-flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Adjust stock"
        onClick={() => onAdjust(product)}
      >
        <PackagePlus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title="Stock history"
        onClick={() => onHistory(product)}
      >
        <History className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title="Edit product"
        onClick={() => onEdit(product)}
      >
        <Edit className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title="Delete product"
        onClick={() => void onDelete(product)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function ProductMobileCard({
  product,
  onAdjust,
  onHistory,
  onEdit,
  onDelete,
}: any) {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-4">
        <ProductIdentity product={product} />

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <InfoTile label="Retail" value={`€${Number(product.selling_price || 0).toFixed(2)}`} />
          <InfoTile label="Stock" value={String(product.current_stock || 0)} />
          <InfoTile label="SKU" value={product.sku || '—'} />
          <InfoTile label="Supplier" value={product.supplier_name || '—'} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <StockBadge product={product} />
          <InventoryActions
            product={product}
            onAdjust={onAdjust}
            onHistory={onHistory}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/35 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-semibold">{value}</div>
    </div>
  );
}

function MovementHistory({
  movements,
  loading,
}: {
  movements: any[];
  loading: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Stock Movement History</CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <EmptyState text="Loading stock movements..." />
        ) : (
          <MovementList movements={movements} />
        )}
      </CardContent>
    </Card>
  );
}

function MovementList({ movements }: { movements: any[] }) {
  if (movements.length === 0) {
    return <EmptyState text="No stock movements recorded." />;
  }

  return (
    <div className="divide-y">
      {movements.map((movement) => {
        const positive = Number(movement.quantity || 0) > 0;

        return (
          <div
            key={movement.id}
            className="flex items-start gap-4 px-5 py-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                positive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {positive ? (
                <ArrowUpCircle className="h-5 w-5" />
              ) : (
                <ArrowDownCircle className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold">
                  {movement.products?.name || 'Product'}
                </div>
                <Badge variant="secondary">
                  {formatMovementType(movement.type)}
                </Badge>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {movement.reason || 'No reason provided'}
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {formatDateTime(movement.created_at)}
              </div>
            </div>

            <div
              className={`text-lg font-bold ${
                positive ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {positive ? '+' : ''}
              {movement.quantity}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StockAlerts({
  products,
  loading,
  onAdjust,
  onEdit,
}: {
  products: any[];
  loading: boolean;
  onAdjust: (product: any) => void;
  onEdit: (product: any) => void;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-amber-200 shadow-card">
      <CardHeader className="bg-amber-50/60">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          Low Stock Alerts
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <EmptyState text="Loading stock alerts..." />
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="mt-4 font-bold">Inventory looks healthy</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No active products are below their minimum stock level.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"
              >
                <ProductIdentity product={product} />

                <div className="flex-1">
                  <StockBadge product={product} />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Minimum required: {product.min_stock}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onAdjust(product)}
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Add Stock
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(product)}
                  >
                    Edit Alert
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>

      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />

      {helper && (
        <p className="text-xs text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-12 text-center text-sm text-muted-foreground">
      <Archive className="mx-auto mb-3 h-8 w-8 opacity-40" />
      {text}
    </div>
  );
}

function formatMovementType(value: string) {
  return String(value || 'adjustment')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
