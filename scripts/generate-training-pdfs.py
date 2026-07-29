#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'training' / 'guides'
LOCALES = ['en', 'el', 'de', 'es', 'tr']
GUIDES = [
    ('getting-started', '/dashboard/business', ['business details', 'timezone', 'currency', 'first-day checklist']),
    ('business-storefront', '/dashboard/storefront', ['public details', 'contact information', 'booking link', 'customer preview']),
    ('services-pricing', '/dashboard/services', ['service name', 'duration', 'price', 'availability impact']),
    ('staff-availability', '/dashboard/staff', ['team member', 'role', 'working hours', 'availability']),
    ('calendar-appointments', '/dashboard/calendar', ['customer', 'service', 'professional', 'date and time']),
    ('customers-profiles', '/dashboard/customers', ['profile details', 'appointment history', 'notes', 'privacy']),
    ('products-sales', '/dashboard/products', ['stock level', 'price', 'sale', 'inventory movement']),
    ('marketing-content', '/dashboard/marketing', ['audience', 'message', 'channel', 'confirmation']),
    ('reports-finance', '/dashboard/reports', ['date range', 'revenue', 'appointments', 'operational trends']),
    ('velliqo-ai', '/dashboard/ai?mode=assistant', ['business question', 'voice or text', 'evidence', 'confirmation']),
    ('automations-security', '/dashboard/ai/settings', ['automation rule', 'autonomy level', 'permissions', 'audit history']),
    ('billing-subscription', '/dashboard/billing', ['active plan', 'payment status', 'invoice', 'subscription change']),
]

TEXT = {
'en': {
    'brand': 'VELLIQO OWNER TRAINING', 'guide': 'Step-by-step guide', 'purpose': 'Purpose',
    'workflow': 'Recommended workflow', 'checklist': 'Owner checklist', 'safety': 'Safety and control',
    'route': 'Related workspace', 'footer': 'Velliqo - Book. Manage. Grow.',
    'steps': [
        'Open the related workspace and confirm that you are working inside the correct business.',
        'Review existing records and settings before creating or changing information.',
        'Complete the required fields carefully and use the checklist below as a final review.',
        'Save the change and confirm the result appears correctly in the workspace and customer experience.',
        'Use Velliqo AI for guidance when useful, but review every confirmation before a protected action is executed.',
    ],
    'safety_text': 'Use only accurate business information. Important actions remain under owner control. Never share passwords, secret keys or sensitive payment information in notes or AI messages.',
    'check_prefix': 'Confirm',
},
'el': {
    'brand': 'ΕΚΠΑΙΔΕΥΣΗ OWNER VELLIQO', 'guide': 'Οδηγός βήμα προς βήμα', 'purpose': 'Σκοπός',
    'workflow': 'Προτεινόμενη διαδικασία', 'checklist': 'Checklist owner', 'safety': 'Ασφάλεια και έλεγχος',
    'route': 'Σχετική σελίδα', 'footer': 'Velliqo - Book. Manage. Grow.',
    'steps': [
        'Άνοιξε τη σχετική σελίδα και επιβεβαίωσε ότι εργάζεσαι στη σωστή επιχείρηση.',
        'Έλεγξε τις υπάρχουσες εγγραφές και ρυθμίσεις πριν δημιουργήσεις ή αλλάξεις δεδομένα.',
        'Συμπλήρωσε προσεκτικά τα υποχρεωτικά πεδία και χρησιμοποίησε το checklist ως τελικό έλεγχο.',
        'Αποθήκευσε την αλλαγή και επιβεβαίωσε ότι εμφανίζεται σωστά στο workspace και στην εμπειρία πελάτη.',
        'Χρησιμοποίησε το Velliqo AI για βοήθεια, αλλά έλεγχε κάθε επιβεβαίωση πριν εκτελεστεί προστατευμένη ενέργεια.',
    ],
    'safety_text': 'Χρησιμοποίησε μόνο ακριβή στοιχεία επιχείρησης. Οι σημαντικές ενέργειες παραμένουν υπό τον έλεγχο του owner. Μην καταχωρίζεις κωδικούς, secret keys ή ευαίσθητα στοιχεία πληρωμών σε σημειώσεις ή μηνύματα AI.',
    'check_prefix': 'Επιβεβαίωσε',
},
'de': {
    'brand': 'VELLIQO INHABER-SCHULUNG', 'guide': 'Schritt-für-Schritt-Anleitung', 'purpose': 'Zweck',
    'workflow': 'Empfohlener Ablauf', 'checklist': 'Inhaber-Checkliste', 'safety': 'Sicherheit und Kontrolle',
    'route': 'Zugehöriger Bereich', 'footer': 'Velliqo - Book. Manage. Grow.',
    'steps': [
        'Öffnen Sie den zugehörigen Bereich und prüfen Sie, ob Sie im richtigen Unternehmen arbeiten.',
        'Prüfen Sie vorhandene Datensätze und Einstellungen, bevor Sie Informationen ändern.',
        'Füllen Sie Pflichtfelder sorgfältig aus und verwenden Sie die Checkliste zur Kontrolle.',
        'Speichern Sie die Änderung und prüfen Sie die Anzeige im Arbeitsbereich und in der Kundenerfahrung.',
        'Nutzen Sie Velliqo AI bei Bedarf, prüfen Sie jedoch jede Bestätigung vor einer geschützten Aktion.',
    ],
    'safety_text': 'Verwenden Sie nur korrekte Unternehmensdaten. Wichtige Aktionen bleiben unter Kontrolle des Inhabers. Teilen Sie keine Passwörter, geheimen Schlüssel oder sensiblen Zahlungsdaten in Notizen oder AI-Nachrichten.',
    'check_prefix': 'Prüfen',
},
'es': {
    'brand': 'FORMACIÓN PARA PROPIETARIOS VELLIQO', 'guide': 'Guía paso a paso', 'purpose': 'Objetivo',
    'workflow': 'Flujo recomendado', 'checklist': 'Lista del propietario', 'safety': 'Seguridad y control',
    'route': 'Área relacionada', 'footer': 'Velliqo - Book. Manage. Grow.',
    'steps': [
        'Abre el área relacionada y confirma que trabajas en el negocio correcto.',
        'Revisa los registros y ajustes existentes antes de crear o modificar información.',
        'Completa los campos obligatorios con cuidado y usa la lista como revisión final.',
        'Guarda el cambio y verifica que aparece correctamente en el espacio y la experiencia del cliente.',
        'Usa Velliqo AI cuando sea útil, pero revisa cada confirmación antes de ejecutar una acción protegida.',
    ],
    'safety_text': 'Utiliza únicamente información empresarial precisa. Las acciones importantes permanecen bajo control del propietario. No compartas contraseñas, claves secretas ni datos sensibles de pago en notas o mensajes de AI.',
    'check_prefix': 'Confirmar',
},
'tr': {
    'brand': 'VELLIQO İŞLETME SAHİBİ EĞİTİMİ', 'guide': 'Adım adım rehber', 'purpose': 'Amaç',
    'workflow': 'Önerilen işlem', 'checklist': 'İşletme sahibi kontrol listesi', 'safety': 'Güvenlik ve kontrol',
    'route': 'İlgili alan', 'footer': 'Velliqo - Book. Manage. Grow.',
    'steps': [
        'İlgili alanı açın ve doğru işletmede çalıştığınızı doğrulayın.',
        'Bilgi oluşturmadan veya değiştirmeden önce mevcut kayıt ve ayarları inceleyin.',
        'Zorunlu alanları dikkatle doldurun ve son kontrol için aşağıdaki listeyi kullanın.',
        'Değişikliği kaydedin ve çalışma alanında ve müşteri deneyiminde doğru göründüğünü doğrulayın.',
        'Gerekli olduğunda Velliqo AI kullanın, ancak korumalı işlemden önce her onayı inceleyin.',
    ],
    'safety_text': 'Yalnızca doğru işletme bilgilerini kullanın. Önemli işlemler işletme sahibinin kontrolünde kalır. Notlarda veya AI mesajlarında parola, gizli anahtar ya da hassas ödeme bilgisi paylaşmayın.',
    'check_prefix': 'Doğrula',
},
}

FOCUS_TRANSLATIONS = {
'el': {
'business details':'στοιχεία επιχείρησης','timezone':'ζώνη ώρας','currency':'νόμισμα','first-day checklist':'checklist πρώτης ημέρας','public details':'δημόσια στοιχεία','contact information':'στοιχεία επικοινωνίας','booking link':'σύνδεσμος κρατήσεων','customer preview':'προεπισκόπηση πελάτη','service name':'όνομα υπηρεσίας','duration':'διάρκεια','price':'τιμή','availability impact':'επίδραση στη διαθεσιμότητα','team member':'μέλος ομάδας','role':'ρόλος','working hours':'ώρες εργασίας','availability':'διαθεσιμότητα','customer':'πελάτης','service':'υπηρεσία','professional':'επαγγελματίας','date and time':'ημερομηνία και ώρα','profile details':'στοιχεία προφίλ','appointment history':'ιστορικό ραντεβού','notes':'σημειώσεις','privacy':'ιδιωτικότητα','stock level':'επίπεδο αποθέματος','sale':'πώληση','inventory movement':'κίνηση αποθέματος','audience':'κοινό','message':'μήνυμα','channel':'κανάλι','confirmation':'επιβεβαίωση','date range':'εύρος ημερομηνιών','revenue':'έσοδα','appointments':'ραντεβού','operational trends':'λειτουργικές τάσεις','business question':'ερώτηση επιχείρησης','voice or text':'φωνή ή κείμενο','evidence':'τεκμηρίωση','automation rule':'κανόνας automation','autonomy level':'επίπεδο αυτονομίας','permissions':'δικαιώματα','audit history':'ιστορικό audit','active plan':'ενεργό πλάνο','payment status':'κατάσταση πληρωμής','invoice':'τιμολόγιο','subscription change':'αλλαγή συνδρομής'},
'de': {'business details':'Unternehmensdaten','timezone':'Zeitzone','currency':'Währung','first-day checklist':'Checkliste für den ersten Tag','public details':'öffentliche Angaben','contact information':'Kontaktdaten','booking link':'Buchungslink','customer preview':'Kundenvorschau','service name':'Servicename','duration':'Dauer','price':'Preis','availability impact':'Auswirkung auf Verfügbarkeit','team member':'Teammitglied','role':'Rolle','working hours':'Arbeitszeiten','availability':'Verfügbarkeit','customer':'Kunde','service':'Service','professional':'Fachkraft','date and time':'Datum und Uhrzeit','profile details':'Profildaten','appointment history':'Terminverlauf','notes':'Notizen','privacy':'Datenschutz','stock level':'Lagerbestand','sale':'Verkauf','inventory movement':'Bestandsbewegung','audience':'Zielgruppe','message':'Nachricht','channel':'Kanal','confirmation':'Bestätigung','date range':'Zeitraum','revenue':'Umsatz','appointments':'Termine','operational trends':'betriebliche Trends','business question':'Unternehmensfrage','voice or text':'Sprache oder Text','evidence':'Nachweise','automation rule':'Automatisierungsregel','autonomy level':'Autonomiestufe','permissions':'Berechtigungen','audit history':'Audit-Verlauf','active plan':'aktiver Plan','payment status':'Zahlungsstatus','invoice':'Rechnung','subscription change':'Abonnementänderung'},
'es': {'business details':'datos del negocio','timezone':'zona horaria','currency':'moneda','first-day checklist':'lista del primer día','public details':'datos públicos','contact information':'información de contacto','booking link':'enlace de reservas','customer preview':'vista del cliente','service name':'nombre del servicio','duration':'duración','price':'precio','availability impact':'impacto en disponibilidad','team member':'miembro del equipo','role':'rol','working hours':'horario laboral','availability':'disponibilidad','customer':'cliente','service':'servicio','professional':'profesional','date and time':'fecha y hora','profile details':'datos del perfil','appointment history':'historial de citas','notes':'notas','privacy':'privacidad','stock level':'nivel de existencias','sale':'venta','inventory movement':'movimiento de inventario','audience':'audiencia','message':'mensaje','channel':'canal','confirmation':'confirmación','date range':'rango de fechas','revenue':'ingresos','appointments':'citas','operational trends':'tendencias operativas','business question':'pregunta del negocio','voice or text':'voz o texto','evidence':'evidencia','automation rule':'regla de automatización','autonomy level':'nivel de autonomía','permissions':'permisos','audit history':'historial de auditoría','active plan':'plan activo','payment status':'estado del pago','invoice':'factura','subscription change':'cambio de suscripción'},
'tr': {'business details':'işletme bilgileri','timezone':'saat dilimi','currency':'para birimi','first-day checklist':'ilk gün kontrol listesi','public details':'herkese açık bilgiler','contact information':'iletişim bilgileri','booking link':'rezervasyon bağlantısı','customer preview':'müşteri önizlemesi','service name':'hizmet adı','duration':'süre','price':'fiyat','availability impact':'müsaitlik etkisi','team member':'ekip üyesi','role':'rol','working hours':'çalışma saatleri','availability':'müsaitlik','customer':'müşteri','service':'hizmet','professional':'profesyonel','date and time':'tarih ve saat','profile details':'profil bilgileri','appointment history':'randevu geçmişi','notes':'notlar','privacy':'gizlilik','stock level':'stok seviyesi','sale':'satış','inventory movement':'stok hareketi','audience':'hedef kitle','message':'mesaj','channel':'kanal','confirmation':'onay','date range':'tarih aralığı','revenue':'gelir','appointments':'randevular','operational trends':'operasyon eğilimleri','business question':'işletme sorusu','voice or text':'ses veya metin','evidence':'kanıt','automation rule':'otomasyon kuralı','autonomy level':'otonomi seviyesi','permissions':'izinler','audit history':'denetim geçmişi','active plan':'aktif plan','payment status':'ödeme durumu','invoice':'fatura','subscription change':'abonelik değişikliği'}
}

FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('VelliqoSans', FONT_REG))
pdfmetrics.registerFont(TTFont('VelliqoSansBold', FONT_BOLD))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Brand', parent=styles['Normal'], fontName='VelliqoSansBold', fontSize=9, leading=12, textColor=colors.HexColor('#6D28D9'), spaceAfter=6))
styles.add(ParagraphStyle(name='TitleV', parent=styles['Title'], fontName='VelliqoSansBold', fontSize=23, leading=28, textColor=colors.HexColor('#111827'), spaceAfter=8))
styles.add(ParagraphStyle(name='SubtitleV', parent=styles['Normal'], fontName='VelliqoSans', fontSize=10, leading=15, textColor=colors.HexColor('#6B7280'), spaceAfter=14))
styles.add(ParagraphStyle(name='HeadingV', parent=styles['Heading2'], fontName='VelliqoSansBold', fontSize=12, leading=16, textColor=colors.HexColor('#2E1065'), spaceBefore=8, spaceAfter=6))
styles.add(ParagraphStyle(name='BodyV', parent=styles['BodyText'], fontName='VelliqoSans', fontSize=9.2, leading=14, textColor=colors.HexColor('#374151'), spaceAfter=6))
styles.add(ParagraphStyle(name='SmallV', parent=styles['BodyText'], fontName='VelliqoSans', fontSize=8, leading=11, textColor=colors.HexColor('#6B7280')))
styles.add(ParagraphStyle(name='SafetyV', parent=styles['BodyText'], fontName='VelliqoSans', fontSize=8.5, leading=13, textColor=colors.HexColor('#78350F')))


def translated_focus(locale: str, item: str) -> str:
    return FOCUS_TRANSLATIONS.get(locale, {}).get(item, item)


def footer(canvas, doc, locale):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#E5E7EB'))
    canvas.line(18*mm, 16*mm, A4[0]-18*mm, 16*mm)
    canvas.setFont('VelliqoSans', 7.5)
    canvas.setFillColor(colors.HexColor('#9CA3AF'))
    canvas.drawString(18*mm, 10*mm, TEXT[locale]['footer'])
    canvas.drawRightString(A4[0]-18*mm, 10*mm, str(doc.page))
    canvas.restoreState()


def build_pdf(locale: str, slug: str, route: str, focus: list[str], title: str, description: str):
    out_dir = OUT / locale
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f'{slug}.pdf'
    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=22*mm, title=title, author='Velliqo')
    tx = TEXT[locale]
    story = [
        Paragraph(tx['brand'], styles['Brand']),
        Paragraph(title, styles['TitleV']),
        Paragraph(tx['guide'], styles['SubtitleV']),
        Paragraph(tx['purpose'], styles['HeadingV']),
        Paragraph(description, styles['BodyV']),
        Paragraph(tx['route'], styles['HeadingV']),
        Paragraph(route, styles['BodyV']),
        Paragraph(tx['workflow'], styles['HeadingV']),
    ]
    for idx, step in enumerate(tx['steps'], 1):
        data = [[Paragraph(str(idx), styles['BodyV']), Paragraph(step, styles['BodyV'])]]
        table = Table(data, colWidths=[10*mm, 150*mm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,0), colors.HexColor('#EDE9FE')),
            ('TEXTCOLOR', (0,0), (0,0), colors.HexColor('#5B21B6')),
            ('ALIGN', (0,0), (0,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#F3F4F6')),
            ('LEFTPADDING', (1,0), (1,0), 8), ('RIGHTPADDING', (1,0), (1,0), 8),
            ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.extend([table, Spacer(1, 3*mm)])
    story.append(Paragraph(tx['checklist'], styles['HeadingV']))
    checklist = []
    for item in focus:
        checklist.append([Paragraph('✓', styles['BodyV']), Paragraph(f"{tx['check_prefix']}: {translated_focus(locale, item)}", styles['BodyV'])])
    table = Table(checklist, colWidths=[8*mm, 152*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F9FAFB')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#E5E7EB')),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.extend([table, Spacer(1, 4*mm), Paragraph(tx['safety'], styles['HeadingV'])])
    safety = Table([[Paragraph(tx['safety_text'], styles['SafetyV'])]], colWidths=[160*mm])
    safety.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#FFFBEB')),('BOX',(0,0),(-1,-1),0.7,colors.HexColor('#F59E0B')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story.append(safety)
    doc.build(story, onFirstPage=lambda c,d: footer(c,d,locale), onLaterPages=lambda c,d: footer(c,d,locale))


def main():
    for locale in LOCALES:
        data = json.loads((ROOT / 'src' / 'i18n' / 'locales' / f'{locale}.json').read_text())
        guides = data['training']['guides']
        for slug, route, focus in GUIDES:
            build_pdf(locale, slug, route, focus, guides[slug]['title'], guides[slug]['description'])
    print(f'Generated {len(LOCALES) * len(GUIDES)} training PDFs in {OUT}')

if __name__ == '__main__':
    main()
