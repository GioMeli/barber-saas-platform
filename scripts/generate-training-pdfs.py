#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List
import hashlib
import tempfile
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'training' / 'guides'
LOCALES = ['en', 'el', 'de', 'es', 'tr']
LOGO = ROOT / 'public' / 'brand' / 'velliqo-logo-transparent.png'
AI_LOGO = ROOT / 'public' / 'brand' / 'velliqo-ai.png'
CACHE = Path(tempfile.gettempdir()) / 'velliqo-training-pdf-assets'
CACHE.mkdir(parents=True, exist_ok=True)

FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('VelliqoSans', FONT_REG))
pdfmetrics.registerFont(TTFont('VelliqoSansBold', FONT_BOLD))

SCREENSHOTS = {
    'getting-started': ['public/marketing/experience/owner/dashboard.jpg', 'public/marketing/screens/precision/dashboard-laptop.webp'],
    'business-storefront': ['public/marketing/experience/owner/storefront-editor.jpg', 'public/marketing/screens/precision/storefront-tablet.webp'],
    'services-pricing': ['public/marketing/product/onboarding-services.png', 'public/marketing/screens/precision/services-tablet.webp'],
    'staff-availability': ['public/marketing/experience/owner/staff.jpg', 'public/marketing/screens/precision/staff-tablet.webp'],
    'calendar-appointments': ['public/marketing/experience/owner/calendar.jpg', 'public/marketing/screens/precision/calendar-phone.webp'],
    'customers-profiles': ['public/marketing/experience/customer/professionals.jpg', 'public/marketing/screens/precision/professionals-tablet.webp'],
    'products-sales': ['public/marketing/experience/owner/appointment.jpg', 'public/marketing/experience/owner/dashboard.jpg'],
    'marketing-content': ['public/marketing/experience/owner/posts-mobile.png', 'public/marketing/experience/owner/gallery-mobile.png'],
    'reports-finance': ['public/marketing/experience/owner/reports.jpg', 'public/marketing/screens/precision/reports-desktop.webp'],
    'velliqo-ai': ['public/brand/velliqo-ai.png', 'public/marketing/experience/owner/dashboard.jpg'],
    'automations-security': ['public/brand/velliqo-ai.png', 'public/marketing/experience/owner/reports.jpg'],
    'billing-subscription': ['public/marketing/experience/owner/dashboard.jpg', 'public/marketing/screens/precision/reports-desktop.webp'],
}

GUIDES = {
    'getting-started': {
        'route': '/dashboard/business',
        'action': {
            'en': 'Open Business from the owner navigation and review the business identity card.',
            'el': 'Άνοιξε την ενότητα Επιχείρηση από το μενού owner και έλεγξε την κάρτα ταυτότητας της επιχείρησης.',
            'de': 'Öffnen Sie Unternehmen in der Inhaber-Navigation und prüfen Sie die Unternehmenskarte.',
            'es': 'Abre Negocio desde la navegación del propietario y revisa la tarjeta de identidad del negocio.',
            'tr': 'İşletme sahibi menüsünden İşletme bölümünü açın ve işletme kimlik kartını inceleyin.',
        },
        'fields': {
            'en': 'Confirm business name, industry, phone, email, address, timezone and currency. Replace sample values with accurate information.',
            'el': 'Επιβεβαίωσε όνομα επιχείρησης, κλάδο, τηλέφωνο, email, διεύθυνση, ζώνη ώρας και νόμισμα. Αντικατάστησε τα δοκιμαστικά στοιχεία με ακριβείς πληροφορίες.',
            'de': 'Prüfen Sie Name, Branche, Telefon, E-Mail, Adresse, Zeitzone und Währung und ersetzen Sie Beispieldaten.',
            'es': 'Confirma nombre, sector, teléfono, correo, dirección, zona horaria y moneda y sustituye los datos de ejemplo.',
            'tr': 'İşletme adı, sektör, telefon, e-posta, adres, saat dilimi ve para birimini doğrulayın; örnek değerleri değiştirin.',
        },
        'verify': {
            'en': 'Save once, refresh the page and confirm the same information appears in the owner header and public storefront preview.',
            'el': 'Αποθήκευσε μία φορά, ανανέωσε τη σελίδα και επιβεβαίωσε ότι τα ίδια στοιχεία εμφανίζονται στην κεφαλίδα owner και στην προεπισκόπηση storefront.',
            'de': 'Speichern Sie, laden Sie neu und prüfen Sie die Angaben in Kopfzeile und Storefront-Vorschau.',
            'es': 'Guarda, actualiza y verifica la información en la cabecera y en la vista previa del escaparate.',
            'tr': 'Kaydedin, sayfayı yenileyin ve bilgilerin üst çubukta ve mağaza önizlemesinde göründüğünü kontrol edin.',
        },
    },
    'business-storefront': {
        'route': '/dashboard/storefront',
        'action': {'en':'Open Storefront and select the public profile or booking preview.','el':'Άνοιξε το Storefront και επίλεξε την προεπισκόπηση δημόσιου προφίλ ή κρατήσεων.','de':'Öffnen Sie Storefront und wählen Sie die öffentliche Profil- oder Buchungsvorschau.','es':'Abre Escaparate y selecciona la vista previa pública o de reservas.','tr':'Storefront bölümünü açın ve genel profil ya da rezervasyon önizlemesini seçin.'},
        'fields': {'en':'Add the public description, contact details, address, booking instructions, logo and approved gallery images.','el':'Πρόσθεσε δημόσια περιγραφή, στοιχεία επικοινωνίας, διεύθυνση, οδηγίες κράτησης, λογότυπο και εγκεκριμένες εικόνες gallery.','de':'Fügen Sie Beschreibung, Kontaktdaten, Adresse, Buchungshinweise, Logo und freigegebene Bilder hinzu.','es':'Añade descripción, contacto, dirección, instrucciones de reserva, logotipo e imágenes aprobadas.','tr':'Genel açıklama, iletişim bilgileri, adres, rezervasyon talimatları, logo ve onaylı galeri görsellerini ekleyin.'},
        'verify': {'en':'Use Preview and open the customer booking link in a private browser window. Confirm services, contact information and availability are correct.','el':'Χρησιμοποίησε το Preview και άνοιξε τον σύνδεσμο κράτησης σε ιδιωτικό παράθυρο. Επιβεβαίωσε υπηρεσίες, επικοινωνία και διαθεσιμότητα.','de':'Öffnen Sie die Vorschau und den Buchungslink privat und prüfen Sie Services, Kontakt und Verfügbarkeit.','es':'Abre la vista previa y el enlace de reserva en modo privado y verifica servicios, contacto y disponibilidad.','tr':'Önizlemeyi ve rezervasyon bağlantısını gizli pencerede açıp hizmet, iletişim ve müsaitliği doğrulayın.'},
    },
    'services-pricing': {
        'route': '/dashboard/services',
        'action': {'en':'Select Add service or open an existing service to edit it.','el':'Επίλεξε Προσθήκη υπηρεσίας ή άνοιξε μία υπάρχουσα υπηρεσία για επεξεργασία.','de':'Wählen Sie Service hinzufügen oder öffnen Sie einen bestehenden Service.','es':'Selecciona Añadir servicio o abre uno existente para editarlo.','tr':'Hizmet ekle seçeneğini kullanın veya mevcut bir hizmeti düzenleyin.'},
        'fields': {'en':'Enter a clear service name, description, exact duration, price, active status and the team members who can provide it.','el':'Καταχώρισε σαφές όνομα, περιγραφή, ακριβή διάρκεια, τιμή, ενεργή κατάσταση και τα μέλη ομάδας που μπορούν να την παρέχουν.','de':'Geben Sie Name, Beschreibung, genaue Dauer, Preis, Status und zuständige Teammitglieder ein.','es':'Introduce nombre, descripción, duración exacta, precio, estado y profesionales asignados.','tr':'Açık hizmet adı, açıklama, kesin süre, fiyat, durum ve hizmeti verecek ekip üyelerini girin.'},
        'verify': {'en':'Save and test the public booking flow. Confirm slot length matches the duration and no overlapping appointment can be created.','el':'Αποθήκευσε και δοκίμασε τη δημόσια κράτηση. Επιβεβαίωσε ότι η διάρκεια του slot είναι σωστή και δεν δημιουργείται σύγκρουση.','de':'Speichern und testen Sie die Buchung. Prüfen Sie Slot-Dauer und Konfliktschutz.','es':'Guarda y prueba la reserva pública. Verifica la duración y la prevención de solapamientos.','tr':'Kaydedin ve genel rezervasyon akışını test edin; süreyi ve çakışma korumasını doğrulayın.'},
    },
    'staff-availability': {
        'route': '/dashboard/staff',
        'action': {'en':'Select Add team member, enter the professional profile and assign the correct role.','el':'Επίλεξε Προσθήκη μέλους ομάδας, συμπλήρωσε το επαγγελματικό προφίλ και όρισε τον σωστό ρόλο.','de':'Wählen Sie Teammitglied hinzufügen, erfassen Sie das Profil und die richtige Rolle.','es':'Selecciona Añadir miembro, completa el perfil y asigna el rol correcto.','tr':'Ekip üyesi ekle seçeneğini kullanın, profili doldurun ve doğru rolü atayın.'},
        'fields': {'en':'Configure working days, start and end times, breaks, services and any day-specific availability.','el':'Ρύθμισε ημέρες εργασίας, ώρες έναρξης και λήξης, διαλείμματα, υπηρεσίες και ειδική διαθεσιμότητα ανά ημέρα.','de':'Konfigurieren Sie Arbeitstage, Zeiten, Pausen, Services und tagesbezogene Verfügbarkeit.','es':'Configura días, horarios, pausas, servicios y disponibilidad específica.','tr':'Çalışma günleri, başlangıç-bitiş saatleri, molalar, hizmetler ve günlük müsaitliği ayarlayın.'},
        'verify': {'en':'Open Calendar and public booking. Confirm the professional appears only during configured hours and only for assigned services.','el':'Άνοιξε Calendar και δημόσια κράτηση. Επιβεβαίωσε ότι ο επαγγελματίας εμφανίζεται μόνο στις σωστές ώρες και υπηρεσίες.','de':'Prüfen Sie Kalender und Buchung: nur konfigurierte Zeiten und zugewiesene Services.','es':'Comprueba calendario y reservas: solo horarios configurados y servicios asignados.','tr':'Takvim ve rezervasyonda yalnızca ayarlanan saat ve hizmetlerde göründüğünü doğrulayın.'},
    },
    'calendar-appointments': {
        'route': '/dashboard/calendar',
        'action': {'en':'Select New appointment or tap an empty time slot in the calendar.','el':'Επίλεξε Νέο ραντεβού ή πάτησε σε κενό time slot στο ημερολόγιο.','de':'Wählen Sie Neuer Termin oder klicken Sie auf einen freien Zeitslot.','es':'Selecciona Nueva cita o pulsa un espacio libre.','tr':'Yeni randevu seçeneğini kullanın veya boş zaman dilimine tıklayın.'},
        'fields': {'en':'Choose customer, service, professional, date and start time. Review duration, price and conflict warnings before confirmation.','el':'Επίλεξε πελάτη, υπηρεσία, επαγγελματία, ημερομηνία και ώρα. Έλεγξε διάρκεια, τιμή και προειδοποιήσεις σύγκρουσης.','de':'Wählen Sie Kunde, Service, Fachkraft, Datum und Zeit; prüfen Sie Dauer, Preis und Konflikte.','es':'Elige cliente, servicio, profesional, fecha y hora; revisa duración, precio y conflictos.','tr':'Müşteri, hizmet, profesyonel, tarih ve saati seçin; süre, fiyat ve çakışma uyarılarını kontrol edin.'},
        'verify': {'en':'Confirm the appointment appears in the correct professional column and customer history. Test edit, reschedule and cancel using the appointment details dialog.','el':'Επιβεβαίωσε ότι εμφανίζεται στη σωστή στήλη επαγγελματία και στο ιστορικό πελάτη. Δοκίμασε edit, reschedule και cancel από το dialog.','de':'Prüfen Sie Spalte und Kundenverlauf und testen Sie Bearbeiten, Verschieben und Stornieren.','es':'Verifica columna e historial y prueba editar, reprogramar y cancelar.','tr':'Doğru profesyonel sütununda ve müşteri geçmişinde göründüğünü kontrol edip düzenleme, taşıma ve iptali deneyin.'},
    },
    'customers-profiles': {
        'route': '/dashboard/customers',
        'action': {'en':'Open Customers, search for a profile or select Add customer.','el':'Άνοιξε Customers, αναζήτησε προφίλ ή επίλεξε Προσθήκη πελάτη.','de':'Öffnen Sie Kunden, suchen Sie ein Profil oder wählen Sie Kunde hinzufügen.','es':'Abre Clientes, busca un perfil o selecciona Añadir cliente.','tr':'Müşteriler bölümünü açın, profil arayın veya müşteri ekleyin.'},
        'fields': {'en':'Enter only necessary contact information, consent preferences and useful service notes. Avoid sensitive data that is not required.','el':'Καταχώρισε μόνο τα απαραίτητα στοιχεία επικοινωνίας, προτιμήσεις συγκατάθεσης και χρήσιμες σημειώσεις. Απόφυγε μη απαραίτητα ευαίσθητα δεδομένα.','de':'Erfassen Sie nur erforderliche Kontakt-, Einwilligungs- und Servicedaten; vermeiden Sie unnötige sensible Angaben.','es':'Introduce solo contacto, consentimientos y notas necesarias; evita datos sensibles innecesarios.','tr':'Yalnızca gerekli iletişim, izin ve hizmet notlarını girin; gereksiz hassas verilerden kaçının.'},
        'verify': {'en':'Open the customer profile and confirm upcoming appointments, history, value and notes belong to the correct person.','el':'Άνοιξε το προφίλ και επιβεβαίωσε ότι επόμενα ραντεβού, ιστορικό, αξία και σημειώσεις ανήκουν στο σωστό άτομο.','de':'Prüfen Sie Profil, Termine, Verlauf, Wert und Notizen der richtigen Person.','es':'Verifica citas, historial, valor y notas de la persona correcta.','tr':'Profil, yaklaşan randevular, geçmiş, değer ve notların doğru kişiye ait olduğunu doğrulayın.'},
    },
    'products-sales': {
        'route': '/dashboard/products',
        'action': {'en':'Open Products to add inventory, then use Sales for a sample checkout.','el':'Άνοιξε Products για προσθήκη αποθέματος και μετά χρησιμοποίησε Sales για checkout.','de':'Öffnen Sie Produkte, erfassen Sie Bestand und nutzen Sie anschließend Verkauf.','es':'Abre Productos, registra inventario y usa Ventas para el cobro.','tr':'Ürünler bölümünden stok ekleyin ve ardından Satışlar bölümünden işlem yapın.'},
        'fields': {'en':'For each product set name, SKU if used, sale price, stock quantity and low-stock threshold. In checkout select customer, items, quantity and payment method.','el':'Για κάθε προϊόν όρισε όνομα, SKU αν χρησιμοποιείται, τιμή, ποσότητα και low-stock threshold. Στο checkout επίλεξε πελάτη, είδη, ποσότητα και τρόπο πληρωμής.','de':'Legen Sie Name, SKU, Preis, Bestand und Mindestbestand fest; wählen Sie im Checkout Kunde, Artikel, Menge und Zahlungsart.','es':'Configura nombre, SKU, precio, stock y mínimo; en caja selecciona cliente, artículos, cantidad y pago.','tr':'Ad, SKU, fiyat, stok ve düşük stok eşiğini ayarlayın; satışta müşteri, ürün, miktar ve ödeme yöntemini seçin.'},
        'verify': {'en':'Complete the sale and confirm receipt status, stock reduction and reporting totals. If voiding, verify stock is restored.','el':'Ολοκλήρωσε την πώληση και επιβεβαίωσε απόδειξη, μείωση stock και reports. Σε void έλεγξε ότι το stock επανέρχεται.','de':'Schließen Sie den Verkauf ab und prüfen Sie Beleg, Bestandsabgang und Berichte; bei Storno muss Bestand zurückkehren.','es':'Completa la venta y verifica recibo, reducción de stock e informes; al anular debe restaurarse el stock.','tr':'Satışı tamamlayın; fiş, stok düşümü ve raporları kontrol edin. İptalde stok geri gelmelidir.'},
    },
    'marketing-content': {
        'route': '/dashboard/marketing',
        'action': {'en':'Open Marketing for campaigns, Posts for announcements and Gallery for approved images.','el':'Άνοιξε Marketing για καμπάνιες, Posts για ανακοινώσεις και Gallery για εγκεκριμένες εικόνες.','de':'Öffnen Sie Marketing für Kampagnen, Posts für Mitteilungen und Galerie für Bilder.','es':'Abre Marketing para campañas, Posts para anuncios y Galería para imágenes.','tr':'Kampanyalar için Marketing, duyurular için Posts ve görseller için Gallery bölümünü açın.'},
        'fields': {'en':'Choose the objective, audience, channel, message and schedule. For posts and gallery content confirm visibility, order and image rights.','el':'Επίλεξε στόχο, κοινό, κανάλι, μήνυμα και πρόγραμμα. Για posts/gallery έλεγξε visibility, σειρά και δικαιώματα εικόνων.','de':'Wählen Sie Ziel, Zielgruppe, Kanal, Nachricht und Zeit; prüfen Sie Sichtbarkeit, Reihenfolge und Bildrechte.','es':'Elige objetivo, audiencia, canal, mensaje y horario; revisa visibilidad, orden y derechos de imagen.','tr':'Amaç, hedef kitle, kanal, mesaj ve zamanı seçin; görünürlük, sıralama ve görsel haklarını kontrol edin.'},
        'verify': {'en':'Review the audience count and content preview before confirmation. Check delivery history and public storefront after publishing.','el':'Έλεγξε audience count και preview πριν την επιβεβαίωση. Μετά έλεγξε delivery history και storefront.','de':'Prüfen Sie Zielgruppenzahl und Vorschau vor Bestätigung sowie Verlauf und Storefront danach.','es':'Revisa audiencia y vista previa antes de confirmar y luego historial y escaparate.','tr':'Onaydan önce hedef kitle sayısı ve önizlemeyi, sonra teslim geçmişi ve storefront’u kontrol edin.'},
    },
    'reports-finance': {
        'route': '/dashboard/reports',
        'action': {'en':'Open Reports, choose the date range and review the summary metrics before opening detailed sections.','el':'Άνοιξε Reports, επίλεξε date range και έλεγξε τα summary metrics πριν τις αναλυτικές ενότητες.','de':'Öffnen Sie Berichte, wählen Sie den Zeitraum und prüfen Sie zuerst die Kennzahlen.','es':'Abre Informes, elige el periodo y revisa primero las métricas resumen.','tr':'Raporlar bölümünü açın, tarih aralığını seçin ve ayrıntılardan önce özet metrikleri inceleyin.'},
        'fields': {'en':'Compare revenue, completed appointments, cancellations, customers, staff utilisation, services and product performance using the same period.','el':'Σύγκρινε έσοδα, completed appointments, cancellations, πελάτες, staff utilisation, υπηρεσίες και προϊόντα στην ίδια περίοδο.','de':'Vergleichen Sie Umsatz, abgeschlossene Termine, Stornos, Kunden, Auslastung, Services und Produkte im gleichen Zeitraum.','es':'Compara ingresos, citas completadas, cancelaciones, clientes, utilización, servicios y productos en el mismo periodo.','tr':'Aynı dönemde gelir, tamamlanan randevu, iptal, müşteri, ekip kullanımı, hizmet ve ürün performansını karşılaştırın.'},
        'verify': {'en':'Export only after confirming the date range and currency. Treat operational reports as business visibility, not formal accounting or tax advice.','el':'Κάνε export μόνο αφού επιβεβαιώσεις date range και νόμισμα. Τα reports είναι λειτουργική πληροφόρηση και όχι λογιστική ή φορολογική συμβουλή.','de':'Exportieren Sie erst nach Prüfung von Zeitraum und Währung; Berichte sind keine Steuer- oder Buchhaltungsberatung.','es':'Exporta solo tras verificar periodo y moneda; los informes no sustituyen asesoría contable o fiscal.','tr':'Tarih aralığı ve para birimini doğruladıktan sonra dışa aktarın; raporlar muhasebe veya vergi danışmanlığı değildir.'},
    },
    'velliqo-ai': {
        'route': '/dashboard/ai?mode=assistant',
        'action': {'en':'Open Velliqo AI from the highlighted owner navigation button and choose text or microphone input.','el':'Άνοιξε το Velliqo AI από το εμφανές κουμπί owner navigation και επίλεξε γραπτό μήνυμα ή μικρόφωνο.','de':'Öffnen Sie Velliqo AI über die hervorgehobene Navigation und wählen Sie Text oder Mikrofon.','es':'Abre Velliqo AI desde el botón destacado y elige texto o micrófono.','tr':'Velliqo AI’ı öne çıkan menü düğmesinden açın ve metin ya da mikrofonu seçin.'},
        'fields': {'en':'Ask a specific business question with a date, customer, service or goal when relevant. Do not include passwords, payment secrets or unnecessary sensitive data.','el':'Κάνε συγκεκριμένη επιχειρησιακή ερώτηση με ημερομηνία, πελάτη, υπηρεσία ή στόχο όταν χρειάζεται. Μην δίνεις passwords, payment secrets ή μη απαραίτητα ευαίσθητα δεδομένα.','de':'Stellen Sie eine konkrete Frage mit Datum, Kunde, Service oder Ziel; keine Passwörter, Zahlungsgeheimnisse oder unnötigen sensiblen Daten.','es':'Haz una pregunta concreta con fecha, cliente, servicio u objetivo; no incluyas contraseñas ni secretos de pago.','tr':'Gerekirse tarih, müşteri, hizmet veya hedef içeren açık soru sorun; parola ve ödeme sırlarını paylaşmayın.'},
        'verify': {'en':'Read the evidence and action summary. For any protected action, inspect the confirmation pop-up, change details if needed and confirm only when correct.','el':'Διάβασε evidence και action summary. Για προστατευμένη ενέργεια έλεγξε το confirmation pop-up, άλλαξε στοιχεία αν χρειάζεται και επιβεβαίωσε μόνο όταν είναι σωστά.','de':'Prüfen Sie Nachweise und Aktionsübersicht; bestätigen Sie geschützte Aktionen erst nach Kontrolle.','es':'Revisa evidencias y resumen; confirma acciones protegidas solo después de verificarlas.','tr':'Kanıt ve işlem özetini okuyun; korumalı işlemleri yalnızca doğruladıktan sonra onaylayın.'},
    },
    'automations-security': {
        'route': '/dashboard/ai/settings',
        'action': {'en':'Open AI Settings and review Manager Automations, action permissions and notification preferences.','el':'Άνοιξε AI Settings και έλεγξε Manager Automations, action permissions και notification preferences.','de':'Öffnen Sie AI-Einstellungen und prüfen Sie Automatisierungen, Berechtigungen und Benachrichtigungen.','es':'Abre Ajustes de AI y revisa automatizaciones, permisos y notificaciones.','tr':'AI Ayarlarını açın; yönetici otomasyonları, işlem izinleri ve bildirimleri inceleyin.'},
        'fields': {'en':'Start with Recommend only. Enable one rule at a time and understand Disabled, Recommend only, Prepare draft and Auto-execute low risk.','el':'Ξεκίνα με Recommend only. Ενεργοποίησε έναν κανόνα τη φορά και κατανόησε Disabled, Recommend only, Prepare draft και Auto-execute low risk.','de':'Beginnen Sie mit Nur empfehlen, aktivieren Sie Regeln einzeln und verstehen Sie alle Autonomiestufen.','es':'Empieza con Solo recomendar, activa reglas una a una y comprende todos los niveles de autonomía.','tr':'Yalnızca öner ile başlayın, kuralları tek tek etkinleştirin ve tüm otonomi seviyelerini anlayın.'},
        'verify': {'en':'Review run history and audit logs. Confirm campaigns are not sent, appointments are not moved and purchases are not placed without the required approval.','el':'Έλεγξε run history και audit logs. Επιβεβαίωσε ότι campaigns δεν αποστέλλονται, appointments δεν μετακινούνται και αγορές δεν γίνονται χωρίς έγκριση.','de':'Prüfen Sie Verlauf und Audit-Logs; keine Kampagne, Terminverschiebung oder Bestellung ohne Freigabe.','es':'Revisa historial y auditoría; nada se envía, mueve o compra sin aprobación.','tr':'Çalıştırma geçmişi ve denetim kayıtlarını inceleyin; onay olmadan gönderim, taşıma veya satın alma olmamalıdır.'},
    },
    'billing-subscription': {
        'route': '/dashboard/billing',
        'action': {'en':'Open Billing and review the current plan, subscription status, renewal date and invoice history.','el':'Άνοιξε Billing και έλεγξε current plan, subscription status, renewal date και invoice history.','de':'Öffnen Sie Abrechnung und prüfen Sie Plan, Status, Verlängerung und Rechnungen.','es':'Abre Facturación y revisa plan, estado, renovación e historial de facturas.','tr':'Faturalandırma bölümünü açın; plan, abonelik durumu, yenileme ve fatura geçmişini inceleyin.'},
        'fields': {'en':'When changing plan or payment method, read the amount, billing interval, tax information and effective date before leaving Velliqo for the secure checkout.','el':'Σε αλλαγή πλάνου ή payment method διάβασε ποσό, billing interval, φορολογικά στοιχεία και effective date πριν μεταβείς στο secure checkout.','de':'Prüfen Sie Betrag, Intervall, Steuerdaten und Wirksamkeitsdatum vor dem sicheren Checkout.','es':'Revisa importe, intervalo, impuestos y fecha efectiva antes del checkout seguro.','tr':'Güvenli ödemeye geçmeden önce tutar, dönem, vergi bilgileri ve geçerlilik tarihini kontrol edin.'},
        'verify': {'en':'Return to Billing and confirm the subscription and invoice status changed only after a successful provider response. Platform subscription charges are separate from customer sales.','el':'Επέστρεψε στο Billing και επιβεβαίωσε ότι subscription/invoice status άλλαξε μόνο μετά από επιτυχή provider response. Οι χρεώσεις πλάνου είναι ξεχωριστές από customer sales.','de':'Prüfen Sie Status erst nach erfolgreicher Anbieterantwort; Plattformgebühren sind getrennt von Kundenumsätzen.','es':'Confirma el estado solo tras respuesta correcta del proveedor; la suscripción es separada de las ventas.','tr':'Sağlayıcı başarılı yanıt verdikten sonra durumu doğrulayın; platform aboneliği müşteri satışlarından ayrıdır.'},
    },
}

UI = {
    'en': {'brand':'VELLIQO OWNER COURSE','guide':'Professional step-by-step guide','route':'Workspace route','outcomes':'What you will complete','steps':'Exact workflow','step1':'Open the correct workspace','step2':'Start the action','step3':'Complete the required information','step4':'Review and confirm','step5':'Verify the result','help':'If the result is not correct','help_text':'Do not repeat the action blindly. Re-open the record, confirm the selected business, date, service and professional, and use Velliqo AI or the Contact page with a screenshot of the issue.','checklist':'Final owner checklist','safety':'Safety and data protection','safety_text':'Use accurate business data. Never place passwords, secret keys, full payment card details or unnecessary sensitive personal information in notes, forms or AI messages.','caption':'Actual Velliqo application example. Layout may adapt to screen size and selected industry.','footer':'Velliqo - Book. Manage. Grow.','page':'Page'},
    'el': {'brand':'ΜΑΘΗΜΑ OWNER VELLIQO','guide':'Επαγγελματικός οδηγός βήμα προς βήμα','route':'Διαδρομή στην εφαρμογή','outcomes':'Τι θα ολοκληρώσεις','steps':'Ακριβής διαδικασία','step1':'Άνοιξε τη σωστή ενότητα','step2':'Ξεκίνα την ενέργεια','step3':'Συμπλήρωσε τα απαραίτητα στοιχεία','step4':'Έλεγξε και επιβεβαίωσε','step5':'Επαλήθευσε το αποτέλεσμα','help':'Αν το αποτέλεσμα δεν είναι σωστό','help_text':'Μην επαναλαμβάνεις την ενέργεια χωρίς έλεγχο. Άνοιξε ξανά την εγγραφή, επιβεβαίωσε επιχείρηση, ημερομηνία, υπηρεσία και επαγγελματία και χρησιμοποίησε το Velliqo AI ή τη σελίδα Contact με screenshot του προβλήματος.','checklist':'Τελικό checklist owner','safety':'Ασφάλεια και προστασία δεδομένων','safety_text':'Χρησιμοποίησε ακριβή στοιχεία επιχείρησης. Μην καταχωρίζεις passwords, secret keys, πλήρη στοιχεία κάρτας ή μη απαραίτητα ευαίσθητα προσωπικά δεδομένα σε σημειώσεις, φόρμες ή μηνύματα AI.','caption':'Πραγματικό παράδειγμα εφαρμογής Velliqo. Η διάταξη προσαρμόζεται στη συσκευή και στον επιλεγμένο κλάδο.','footer':'Velliqo - Book. Manage. Grow.','page':'Σελίδα'},
    'de': {'brand':'VELLIQO INHABERKURS','guide':'Professionelle Schritt-für-Schritt-Anleitung','route':'Bereich in der Anwendung','outcomes':'Was Sie abschließen','steps':'Genauer Ablauf','step1':'Richtigen Bereich öffnen','step2':'Aktion starten','step3':'Pflichtangaben ausfüllen','step4':'Prüfen und bestätigen','step5':'Ergebnis verifizieren','help':'Wenn das Ergebnis nicht stimmt','help_text':'Wiederholen Sie die Aktion nicht blind. Öffnen Sie den Datensatz, prüfen Sie Unternehmen, Datum, Service und Fachkraft und nutzen Sie Velliqo AI oder Kontakt mit Screenshot.','checklist':'Abschluss-Checkliste','safety':'Sicherheit und Datenschutz','safety_text':'Verwenden Sie korrekte Geschäftsdaten. Keine Passwörter, geheimen Schlüssel, vollständigen Kartendaten oder unnötigen sensiblen Informationen in Notizen, Formularen oder AI-Nachrichten.','caption':'Echtes Velliqo-Anwendungsbeispiel. Das Layout passt sich Gerät und Branche an.','footer':'Velliqo - Book. Manage. Grow.','page':'Seite'},
    'es': {'brand':'CURSO PARA PROPIETARIOS VELLIQO','guide':'Guía profesional paso a paso','route':'Ruta en la aplicación','outcomes':'Qué completarás','steps':'Proceso exacto','step1':'Abrir el área correcta','step2':'Iniciar la acción','step3':'Completar la información','step4':'Revisar y confirmar','step5':'Verificar el resultado','help':'Si el resultado no es correcto','help_text':'No repitas la acción sin revisar. Abre el registro, confirma negocio, fecha, servicio y profesional y usa Velliqo AI o Contacto con una captura.','checklist':'Lista final del propietario','safety':'Seguridad y protección de datos','safety_text':'Usa datos empresariales correctos. No introduzcas contraseñas, claves secretas, tarjetas completas ni información sensible innecesaria en notas, formularios o AI.','caption':'Ejemplo real de Velliqo. El diseño se adapta al dispositivo y al sector.','footer':'Velliqo - Book. Manage. Grow.','page':'Página'},
    'tr': {'brand':'VELLIQO İŞLETME SAHİBİ KURSU','guide':'Profesyonel adım adım rehber','route':'Uygulama yolu','outcomes':'Tamamlayacağınız işlem','steps':'Kesin iş akışı','step1':'Doğru alanı açın','step2':'İşlemi başlatın','step3':'Gerekli bilgileri tamamlayın','step4':'İnceleyin ve onaylayın','step5':'Sonucu doğrulayın','help':'Sonuç doğru değilse','help_text':'İşlemi kontrol etmeden tekrarlamayın. Kaydı açın, işletme, tarih, hizmet ve profesyoneli doğrulayın; ekran görüntüsüyle Velliqo AI veya İletişim sayfasını kullanın.','checklist':'Son işletme sahibi kontrol listesi','safety':'Güvenlik ve veri koruması','safety_text':'Doğru işletme verilerini kullanın. Not, form veya AI mesajlarına parola, gizli anahtar, tam kart bilgisi ya da gereksiz hassas kişisel veri girmeyin.','caption':'Gerçek Velliqo uygulama örneği. Düzen cihaz ve sektöre göre uyarlanabilir.','footer':'Velliqo - Book. Manage. Grow.','page':'Sayfa'},
}

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Brand', fontName='VelliqoSansBold', fontSize=8.5, leading=11, textColor=colors.HexColor('#6D28D9'), spaceAfter=5))
styles.add(ParagraphStyle(name='TitleV', fontName='VelliqoSansBold', fontSize=25, leading=29, textColor=colors.HexColor('#111827'), spaceAfter=8))
styles.add(ParagraphStyle(name='SubtitleV', fontName='VelliqoSans', fontSize=10.5, leading=16, textColor=colors.HexColor('#6B7280'), spaceAfter=10))
styles.add(ParagraphStyle(name='H1', fontName='VelliqoSansBold', fontSize=15, leading=20, textColor=colors.HexColor('#2E1065'), spaceBefore=5, spaceAfter=7))
styles.add(ParagraphStyle(name='H2', fontName='VelliqoSansBold', fontSize=11, leading=15, textColor=colors.HexColor('#4C1D95'), spaceAfter=4))
styles.add(ParagraphStyle(name='Body', fontName='VelliqoSans', fontSize=9, leading=14, textColor=colors.HexColor('#374151'), spaceAfter=5))
styles.add(ParagraphStyle(name='Small', fontName='VelliqoSans', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#6B7280')))
styles.add(ParagraphStyle(name='SmallCenter', fontName='VelliqoSans', fontSize=7.5, leading=10.5, alignment=TA_CENTER, textColor=colors.HexColor('#6B7280')))
styles.add(ParagraphStyle(name='StepNumber', fontName='VelliqoSansBold', fontSize=10, leading=12, alignment=TA_CENTER, textColor=colors.white))
styles.add(ParagraphStyle(name='Checklist', fontName='VelliqoSans', fontSize=8.7, leading=13, textColor=colors.HexColor('#1F2937')))

class VelliqoDocTemplate(BaseDocTemplate):
    def __init__(self, filename, locale, title):
        super().__init__(filename, pagesize=A4, leftMargin=17*mm, rightMargin=17*mm, topMargin=17*mm, bottomMargin=20*mm, title=title, author='Velliqo', pageCompression=1)
        self.locale = locale
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='normal')
        self.addPageTemplates(PageTemplate(id='velliqo', frames=[frame], onPage=self._decorate))

    def _decorate(self, canvas, doc):
        tx = UI[self.locale]
        canvas.saveState()
        canvas.setFillColor(colors.HexColor('#0D0B18'))
        canvas.rect(0, A4[1]-8*mm, A4[0], 8*mm, fill=1, stroke=0)
        canvas.setStrokeColor(colors.HexColor('#E5E7EB'))
        canvas.line(17*mm, 15*mm, A4[0]-17*mm, 15*mm)
        canvas.setFont('VelliqoSans', 7.2)
        canvas.setFillColor(colors.HexColor('#9CA3AF'))
        canvas.drawString(17*mm, 9*mm, tx['footer'])
        canvas.drawRightString(A4[0]-17*mm, 9*mm, f"{tx['page']} {doc.page}")
        canvas.restoreState()


def optimized_asset(path: Path, max_px: int = 1400, quality: int = 72) -> Path:
    key = hashlib.sha256(f'{path.resolve()}:{path.stat().st_mtime_ns}:{max_px}:{quality}'.encode()).hexdigest()[:20]
    target = CACHE / f'{key}.jpg'
    if target.exists():
        return target
    with PILImage.open(path) as source:
        image = source.convert('RGBA')
        background = PILImage.new('RGB', image.size, 'white')
        if 'A' in image.getbands():
            background.paste(image, mask=image.getchannel('A'))
        else:
            background.paste(image.convert('RGB'))
        background.thumbnail((max_px, max_px), PILImage.Resampling.LANCZOS)
        background.save(target, format='JPEG', quality=quality, optimize=True, progressive=True)
    return target


def fit_image(path: Path, max_width: float, max_height: float) -> Image:
    with PILImage.open(path) as im:
        w, h = im.size
    scale = min(max_width / w, max_height / h)
    image = Image(str(path), width=w*scale, height=h*scale)
    image.hAlign = 'CENTER'
    return image


def step_block(number: int, heading: str, body: str):
    table = Table([
        [Paragraph(str(number), styles['StepNumber']), Paragraph(f'<b>{heading}</b><br/>{body}', styles['Body'])]
    ], colWidths=[10*mm, 153*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(0,0),colors.HexColor('#6D28D9')),
        ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('BOX',(0,0),(-1,-1),0.6,colors.HexColor('#DDD6FE')),
        ('LEFTPADDING',(0,0),(0,0),5),('RIGHTPADDING',(0,0),(0,0),5),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LEFTPADDING',(1,0),(1,0),9),('RIGHTPADDING',(1,0),(1,0),9),
    ]))
    return table


def build_pdf(locale: str, slug: str, title: str, description: str):
    tx = UI[locale]
    guide = GUIDES[slug]
    output_dir = OUT / locale
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f'{slug}.pdf'
    doc = VelliqoDocTemplate(str(path), locale, title)
    screenshot_paths = [optimized_asset(ROOT / value) for value in SCREENSHOTS[slug]]

    outcomes = [
        guide['action'][locale],
        guide['fields'][locale],
        guide['verify'][locale],
    ]
    story: List = []
    story.append(Table([[Image(str(optimized_asset(LOGO, max_px=180, quality=82)), width=18*mm, height=18*mm), [Paragraph(tx['brand'], styles['Brand']), Paragraph(title, styles['TitleV']), Paragraph(tx['guide'], styles['SubtitleV'])]]], colWidths=[23*mm, 140*mm], style=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)])))
    hero = Table([[Paragraph(description, styles['Body'])]], colWidths=[163*mm])
    hero.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#F5F3FF')),('BOX',(0,0),(-1,-1),0.8,colors.HexColor('#C4B5FD')),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
    story += [hero, Spacer(1,5*mm), Paragraph(tx['route'], styles['H2']), Paragraph(guide['route'], styles['Body']), Paragraph(tx['outcomes'], styles['H1'])]
    for item in outcomes:
        story.append(Paragraph(f'• {item}', styles['Body']))
    story += [Spacer(1,3*mm), fit_image(screenshot_paths[0], 160*mm, 74*mm), Spacer(1,2*mm), Paragraph(tx['caption'], styles['SmallCenter']), PageBreak()]

    story += [Paragraph(tx['brand'], styles['Brand']), Paragraph(tx['steps'], styles['H1'])]
    step_bodies = [
        (tx['step1'], guide['action'][locale]),
        (tx['step2'], guide['action'][locale]),
        (tx['step3'], guide['fields'][locale]),
        (tx['step4'], guide['fields'][locale]),
        (tx['step5'], guide['verify'][locale]),
    ]
    for idx, (heading, body) in enumerate(step_bodies[:3], 1):
        story += [step_block(idx, heading, body), Spacer(1,3.2*mm)]
    story += [Spacer(1,2*mm), fit_image(screenshot_paths[1], 160*mm, 85*mm), Spacer(1,2*mm), Paragraph(tx['caption'], styles['SmallCenter']), PageBreak()]

    story += [Paragraph(tx['brand'], styles['Brand']), Paragraph(tx['steps'], styles['H1'])]
    for idx, (heading, body) in enumerate(step_bodies[3:], 4):
        story += [step_block(idx, heading, body), Spacer(1,4*mm)]
    story += [Paragraph(tx['checklist'], styles['H1'])]
    checklist = [
        guide['action'][locale],
        guide['fields'][locale],
        guide['verify'][locale],
    ]
    table = Table([[Paragraph('✓', styles['Checklist']), Paragraph(item, styles['Checklist'])] for item in checklist], colWidths=[8*mm,155*mm])
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#F9FAFB')),('BOX',(0,0),(-1,-1),0.6,colors.HexColor('#E5E7EB')),('INNERGRID',(0,0),(-1,-1),0.25,colors.HexColor('#E5E7EB')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [table, Spacer(1,5*mm), Paragraph(tx['help'], styles['H1']), Paragraph(tx['help_text'], styles['Body']), Spacer(1,4*mm)]
    safety = Table([[Image(str(optimized_asset(AI_LOGO, max_px=160, quality=82)), width=14*mm, height=14*mm), [Paragraph(tx['safety'], styles['H2']), Paragraph(tx['safety_text'], styles['Body'])]]], colWidths=[20*mm,143*mm])
    safety.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#FFFBEB')),('BOX',(0,0),(-1,-1),0.8,colors.HexColor('#F59E0B')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    story.append(safety)
    doc.build(story)


def main():
    for locale in LOCALES:
        translations = json.loads((ROOT / 'src' / 'i18n' / 'locales' / f'{locale}.json').read_text())
        for slug in GUIDES:
            guide = translations['training']['guides'][slug]
            build_pdf(locale, slug, guide['title'], guide['description'])
    print(f'Generated {len(LOCALES)*len(GUIDES)} professional training PDFs in {OUT}')

if __name__ == '__main__':
    main()
