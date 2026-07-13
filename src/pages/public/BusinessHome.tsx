import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { MapPin, Phone, Mail, CalendarDays, Info, ShoppingBag, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';

import { useTranslation } from 'react-i18next';

export default function BusinessHome() {
  const { business } = useOutletContext<{ business: any }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) {
      fetchData();
    }
  }, [business?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, productsRes] = await Promise.all([
        supabase.from('services').select('*, service_categories(name)').eq('business_id', business.id).eq('is_active', true).order('category_id'),
        supabase.from('products').select('*').eq('business_id', business.id).eq('is_active', true)
      ]);

      if (!servicesRes.error) setServices(servicesRes.data || []);
      if (!productsRes.error) setProducts(productsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc: any, service: any) => {
    const catName = service.service_categories?.name || 'Uncategorized';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(service);
    return acc;
  }, {});

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Cover Photos */}
      <div className="w-full h-[40vh] min-h-[300px] bg-card relative overflow-hidden">
        {business.photos && business.photos.length > 0 ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
            <img src={business.photos[0]} alt="Cover" className="w-full h-full object-cover" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-primary/5">
            <CalendarDays className="w-16 h-16 mb-2 opacity-50" />
            <p>Welcome to {business.name}</p>
          </div>
        )}
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 -mt-20 relative z-20 space-y-12 pb-12">
        {/* Header Block */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground drop-shadow-sm">{business.name}</h1>
          {business.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">{business.description}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <Link to={`/app/${business.slug}/book`} className="flex-1">
            <Button className="w-full text-lg h-14 uppercase tracking-widest font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
              New Appointment
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            className="flex-1 h-14 text-md uppercase tracking-wide border-primary/30 hover:bg-primary/10"
            onClick={() => {
              if (user) {
                window.location.href = '/my-bookings';
              } else {
                sessionStorage.removeItem(`gatePassed_${business.slug}`);
                window.location.href = `/app/${business.slug}`;
              }
            }}
          >
            My Appointments
          </Button>
        </div>

        {/* Two Column Layout for Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Content: Services and Products */}
          <div className="lg:col-span-2 space-y-12">
            {/* Services Section */}
            {Object.keys(servicesByCategory).length > 0 && (
              <section className="space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 border-b border-border pb-2">
                  <Scissors className="w-6 h-6 text-primary" /> Services
                </h3>
                
                <div className="space-y-8">
                  {Object.entries(servicesByCategory).map(([category, items]: [string, any]) => (
                    <div key={category} className="space-y-4">
                      <h4 className="text-xl font-semibold text-primary">{category}</h4>
                      <div className="grid gap-4">
                        {items.map((service: any) => (
                          <div key={service.id} className="flex justify-between p-4 border border-border/50 rounded-xl bg-card hover:bg-accent/5 transition-colors group">
                            <div className="pr-4">
                              <div className="font-bold text-lg group-hover:text-primary transition-colors">{service.name}</div>
                              {service.description && (
                                <div className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{service.description}</div>
                              )}
                              <div className="text-sm text-muted-foreground mt-2 font-medium bg-muted/50 inline-block px-2 py-1 rounded">{service.duration} mins</div>
                            </div>
                            <div className="font-bold text-xl shrink-0 text-primary">${service.price.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Products Section */}
            {products.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 border-b border-border pb-2">
                  <ShoppingBag className="w-6 h-6 text-primary" /> Products
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {products.map((product: any) => (
                    <div key={product.id} className="border border-border/50 rounded-xl overflow-hidden flex flex-col bg-card hover:border-primary/30 transition-colors group">
                      {product.image_url ? (
                        <div className="aspect-square bg-muted relative overflow-hidden">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="aspect-square bg-muted flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="w-10 h-10 opacity-20" />
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div className="font-semibold line-clamp-2">{product.name}</div>
                        <div className="font-bold text-lg mt-3 text-primary">${product.selling_price?.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: Info, Map, Gallery */}
          <div className="space-y-8 lg:sticky lg:top-24">
            
            {/* Info Section */}
            <section className="space-y-4 bg-card border border-border/50 p-6 rounded-xl">
              <h3 className="text-xl font-bold flex items-center gap-3 mb-4">
                <Info className="w-5 h-5 text-primary" /> Info
              </h3>
              
              <div className="space-y-4">
                {business.address && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-sm font-medium pt-2">{business.address}</div>
                  </div>
                )}
                
                {business.phone && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-sm font-medium pt-2">
                      <a href={`tel:${business.phone}`} className="hover:text-primary transition-colors">{business.phone}</a>
                    </div>
                  </div>
                )}

                {business.email && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-sm font-medium pt-2">
                      <a href={`mailto:${business.email}`} className="hover:text-primary transition-colors">{business.email}</a>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Map Section */}
            {business.map_url && (
              <section className="space-y-4 bg-card border border-border/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold flex items-center gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-primary" /> Location
                </h3>
                <div className="w-full aspect-video sm:aspect-square lg:aspect-[4/3] rounded-lg overflow-hidden border border-border">
                  <iframe 
                    src={business.map_url} 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              </section>
            )}
            
            {/* Additional Photos */}
            {business.photos && business.photos.length > 1 && (
              <section className="space-y-4 bg-card border border-border/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4">Gallery</h3>
                <div className="grid grid-cols-2 gap-3">
                  {business.photos.slice(1).map((photo: string, index: number) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden bg-muted relative group">
                      <img src={photo} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
