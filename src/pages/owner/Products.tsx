import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
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
  const { t } = useTranslation();
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
      toast.error(error.message || t('products.messages.loadError'));
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
      toast.error(t('products.validation.nameRequired'));
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
      toast.error(t('products.validation.numericValues'));
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
        toast.success(t('products.messages.updated'));
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

        toast.success(t('products.messages.added'));
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('products.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStock = async () => {
    if (!businessId) return;

    const quantity = Math.floor(Number(stockAdj.quantity));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error(t('products.validation.quantityPositive'));
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
      toast.error(t('products.validation.negativeStock'));
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

      toast.success(t('products.messages.adjusted'));
      setIsStockDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('products.messages.adjustError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: any) => {
    const confirmed = window.confirm(
      t('products.delete.confirm', { name: product.name })
    );

    if (!confirmed || !businessId) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(t('products.messages.deleted'));
      await fetchData();
    } catch (error: any) {
      toast.error(
        error.message || t('products.messages.deleteBlocked')
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
            {t('products.eyebrow')}
          </div>

          <h1 className="app-page-title">{t('products.title')}</h1>

          <p className="app-page-description">
            {t('products.description')}
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('products.actions.add')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('products.summary.active.title')}
          value={products.filter((product) => product.is_active).length}
          detail={t('products.summary.active.detail', { count: products.length })}
          icon={<PackageCheck className="h-5 w-5" />}
        />

        <MetricCard
          title={t('products.summary.lowStock.title')}
          value={lowStockProducts.length}
          detail={t('products.summary.lowStock.detail', { count: outOfStockProducts.length })}
          icon={<TrendingDown className="h-5 w-5" />}
          alert={lowStockProducts.length > 0}
        />

        <MetricCard
          title={t('products.summary.costValue.title')}
          value={`€${stockValue.toFixed(2)}`}
          detail={t('products.summary.costValue.detail')}
          icon={<Boxes className="h-5 w-5" />}
        />

        <MetricCard
          title={t('products.summary.retailValue.title')}
          value={`€${retailValue.toFixed(2)}`}
          detail={t('products.summary.retailValue.detail')}
          icon={<Euro className="h-5 w-5" />}
        />
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-card">
        <InventoryTabButton
          active={activeTab === 'products'}
          label={t('products.tabs.products')}
          icon={<Package className="h-4 w-4" />}
          onClick={() => setActiveTab('products')}
        />
        <InventoryTabButton
          active={activeTab === 'movements'}
          label={t('products.tabs.movements')}
          icon={<History className="h-4 w-4" />}
          onClick={() => setActiveTab('movements')}
        />
        <InventoryTabButton
          active={activeTab === 'alerts'}
          label={t('products.tabs.alerts', { count: lowStockProducts.length })}
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
                  placeholder={t('products.search.placeholder')}
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
                <option value="all">{t('products.filters.allCategories')}</option>
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
              <EmptyState text={t('products.states.loadingInventory')} />
            ) : filteredProducts.length === 0 ? (
              <EmptyState text={t('products.states.emptyProducts')} />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/35 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">{t('products.table.product')}</th>
                        <th className="px-5 py-3 font-semibold">{t('products.table.skuBarcode')}</th>
                        <th className="px-5 py-3 font-semibold">{t('products.table.supplier')}</th>
                        <th className="px-5 py-3 font-semibold">{t('products.table.cost')}</th>
                        <th className="px-5 py-3 font-semibold">{t('products.table.retail')}</th>
                        <th className="px-5 py-3 font-semibold">{t('products.table.stock')}</th>
                        <th className="px-5 py-3 font-semibold">{t('products.table.status')}</th>
                        <th className="px-5 py-3 text-right font-semibold">{t('products.table.actions')}</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-muted/25">
                          <td className="px-5 py-4">
                            <ProductIdentity product={product} />
                          </td>

                          <td className="px-5 py-4 text-muted-foreground">
                            <div>{product.sku || t('products.labels.noSku')}</div>
                            <div className="mt-1 text-xs">
                              {product.barcode || t('products.labels.noBarcode')}
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
                              {product.is_active
                                ? t('products.labels.active')
                                : t('products.labels.inactive')}
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
              {editingId
                ? t('products.dialog.editTitle')
                : t('products.dialog.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label>{t('products.dialog.image')}</Label>

              {formData.image_url ? (
                <div className="group relative h-36 w-36 overflow-hidden rounded-2xl border">
                  <img
                    src={formData.image_url}
                    alt={t('products.dialog.imageAlt')}
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
                      {t('products.actions.removeImage')}
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
                label={t('products.fields.nameRequired')}
                value={formData.name}
                onChange={(value) =>
                  setFormData({ ...formData, name: value })
                }
              />

              <Field
                label={t('products.fields.brand')}
                value={formData.brand}
                onChange={(value) =>
                  setFormData({ ...formData, brand: value })
                }
              />

              <Field
                label={t('products.fields.sku')}
                value={formData.sku}
                onChange={(value) =>
                  setFormData({ ...formData, sku: value })
                }
              />

              <Field
                label={t('products.fields.barcode')}
                value={formData.barcode}
                onChange={(value) =>
                  setFormData({ ...formData, barcode: value })
                }
              />

              <Field
                label={t('products.fields.category')}
                value={formData.category}
                onChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              />

              <Field
                label={t('products.fields.supplier')}
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
                label={t('products.fields.costPrice')}
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
                label={t('products.fields.sellingPriceRequired')}
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
                label={t('products.fields.currentStock')}
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
                    ? t('products.helpers.existingStock')
                    : t('products.helpers.openingStock')
                }
              />

              <Field
                label={t('products.fields.minStockAlert')}
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
                <Label>{t('products.dialog.activeTitle')}</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('products.dialog.activeHelp')}
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
              {t('common.cancel')}
            </Button>

            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? t('products.actions.saving') : t('products.actions.save')}
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
              {t('products.adjustment.title', { name: stockAdj.product_name })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label>{t('products.fields.adjustmentType')}</Label>

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
                <option value="purchase">{t('products.adjustment.purchase')}</option>
                <option value="return">{t('products.adjustment.return')}</option>
                <option value="sale">{t('products.adjustment.sale')}</option>
                <option value="internal_use">{t('products.adjustment.internalUse')}</option>
                <option value="damage">{t('products.adjustment.damage')}</option>
                <option value="expired">{t('products.adjustment.expired')}</option>
                <option value="correction">{t('products.adjustment.correction')}</option>
              </select>
            </div>

            <Field
              label={
                stockAdj.type === 'correction'
                  ? t('products.fields.exactQuantity')
                  : t('products.fields.quantity')
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
              label={t('products.fields.reasonNotes')}
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
              {t('common.cancel')}
            </Button>

            <Button
              disabled={saving}
              onClick={() => void handleSaveStock()}
            >
              {saving
                ? t('products.actions.saving')
                : t('products.actions.confirmAdjustment')}
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
              {t('products.history.title', { name: selectedProduct?.name })}
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
  const { t } = useTranslation();

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
            t('products.labels.uncategorized')}
        </div>
      </div>
    </div>
  );
}

function StockBadge({ product }: { product: any }) {
  const { t } = useTranslation();
  const current = Number(product.current_stock || 0);
  const minimum = Number(product.min_stock || 0);

  if (current <= 0) {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        {t('products.labels.outOfStock')}
      </Badge>
    );
  }

  if (current <= minimum) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        {t('products.labels.lowStock', { count: current })}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {t('products.labels.available', { count: current })}
    </Badge>
  );
}

function InventoryActions({
  product,
  onAdjust,
  onHistory,
  onEdit,
  onDelete,
}: any) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        title={t('products.actions.adjust')}
        aria-label={t('products.actions.adjust')}
        onClick={() => onAdjust(product)}
      >
        <PackagePlus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title={t('products.actions.history')}
        aria-label={t('products.actions.history')}
        onClick={() => onHistory(product)}
      >
        <History className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title={t('products.actions.edit')}
        aria-label={t('products.actions.edit')}
        onClick={() => onEdit(product)}
      >
        <Edit className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title={t('products.actions.delete')}
        aria-label={t('products.actions.delete')}
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
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-4">
        <ProductIdentity product={product} />

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <InfoTile label={t('products.table.retail')} value={`€${Number(product.selling_price || 0).toFixed(2)}`} />
          <InfoTile label={t('products.table.stock')} value={String(product.current_stock || 0)} />
          <InfoTile label={t('products.fields.sku')} value={product.sku || '—'} />
          <InfoTile label={t('products.fields.supplier')} value={product.supplier_name || '—'} />
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
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>{t('products.history.pageTitle')}</CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <EmptyState text={t('products.states.loadingMovements')} />
        ) : (
          <MovementList movements={movements} />
        )}
      </CardContent>
    </Card>
  );
}

function MovementList({ movements }: { movements: any[] }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  if (movements.length === 0) {
    return <EmptyState text={t('products.states.emptyMovements')} />;
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
                  {movement.products?.name || t('products.labels.productFallback')}
                </div>
                <Badge variant="secondary">
                  {t(`products.movements.types.${movement.type || 'adjustment'}`)}
                </Badge>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {formatMovementReason(movement.reason, t)}
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {formatDateTime(movement.created_at, locale)}
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
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-2xl border-amber-200 shadow-card">
      <CardHeader className="bg-amber-50/60">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          {t('products.alerts.title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <EmptyState text={t('products.states.loadingAlerts')} />
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="mt-4 font-bold">{t('products.states.healthyTitle')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('products.states.healthyDescription')}
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
                    {t('products.labels.minimumRequired', { count: product.min_stock })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onAdjust(product)}
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {t('products.actions.addStock')}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(product)}
                  >
                    {t('products.actions.editAlert')}
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

function formatMovementReason(
  value: string | null | undefined,
  t: (key: string) => string
) {
  if (!value) return t('products.labels.noReason');
  if (value === 'Opening stock') return t('products.movements.openingStock');
  return value;
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
