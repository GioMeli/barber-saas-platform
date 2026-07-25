import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ENGINE_NAME = 'velliqo-insights-v1';

const ALLOWED_AGENTS = new Set([
  'business_coach',
  'financial_analyst',
  'marketing_expert',
  'scheduling_assistant',
  'customer_success',
  'inventory_advisor',
  'support_assistant',
]);

const CAPABILITIES_BY_ROLE: Record<string, string[]> = {
  Owner: ['business_metrics', 'revenue', 'appointments', 'customers', 'staff', 'services', 'inventory', 'marketing', 'settings'],
  Manager: ['business_metrics', 'appointments', 'customers', 'staff', 'services', 'inventory', 'marketing'],
  Employee: ['appointments', 'customers', 'services'],
};

const REQUIRED_CAPABILITY_BY_AGENT: Record<string, string | null> = {
  business_coach: 'business_metrics',
  financial_analyst: 'revenue',
  marketing_expert: 'marketing',
  scheduling_assistant: 'appointments',
  customer_success: 'customers',
  inventory_advisor: 'inventory',
  support_assistant: null,
};

type AILanguage = 'en' | 'el' | 'de' | 'es' | 'tr';
type Topic = 'business_health' | 'finance' | 'customers' | 'scheduling' | 'staff' | 'services' | 'inventory' | 'marketing' | 'support';
type InsightCategory = Exclude<Topic, 'support'>;
type InsightSeverity = 'info' | 'opportunity' | 'warning' | 'critical';

type RequestBody = {
  businessId?: string;
  agent?: string;
  message?: string;
  conversationId?: string | null;
  language?: string;
  page?: string | null;
  periodDays?: number;
};

type Insight = {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  evidence: string[];
  recommendation: string;
};

type SuggestedAction = {
  type: 'open_calendar' | 'open_finance' | 'open_customers' | 'open_staff' | 'open_services' | 'open_inventory' | 'open_marketing' | 'open_reports';
  title: string;
  rationale: string;
  destinationPath: string;
};

type StructuredAIResponse = {
  answer: string;
  executive_summary: string;
  business_health_score: number;
  confidence: 'low' | 'medium' | 'high';
  insights: Insight[];
  suggested_actions: SuggestedAction[];
  follow_up_questions: string[];
};

type AnalysisContext = {
  language: AILanguage;
  topic: Topic;
  message: string;
  responseStyle: string;
  snapshot: any;
  asksWhy: boolean;
};

const COPY: Record<AILanguage, Record<string, string>> = {
  en: {
    healthExcellent: 'Business health is strong and the main indicators are stable.',
    healthGood: 'Business health is generally good, with a few areas worth reviewing.',
    healthWatch: 'Business health needs attention because several indicators are under pressure.',
    healthCritical: 'Business health requires immediate review of the most important warning indicators.',
    healthScore: 'The calculated business health score is {score}/100 for the last {days} days.',
    noData: 'There is not enough recorded activity yet to make a high-confidence assessment.',
    revenueLine: 'Collected revenue is {revenue} from {transactions} completed sales during the last {days} days.',
    revenueUp: 'Revenue increased by {change}% compared with the previous equivalent period.',
    revenueDown: 'Revenue decreased by {change}% compared with the previous equivalent period.',
    revenueFlat: 'Revenue is broadly stable compared with the previous equivalent period ({change}%).',
    revenueNoComparison: 'There is not enough revenue in the previous period for a reliable percentage comparison.',
    profitLine: 'Operating profit is {profit}, paid expenses are {expenses}, and gross margin is {margin}%.',
    averageTicket: 'Average transaction value is {ticket}.',
    schedulingLine: 'There were {total} appointments: {completed} completed, {cancelled} cancelled and {noShows} no-shows.',
    schedulingRates: 'Completion rate is {completion}%, cancellation rate is {cancellation}% and no-show rate is {noShow}%.',
    upcomingLine: '{count} appointments are currently scheduled for the next seven days.',
    customersLine: 'The business has {total} customers, including {newCount} new customers in this period.',
    retentionLine: '{returning} customers have returned at least once ({rate}% returning rate), while {atRisk} are currently at risk of inactivity.',
    staffLine: 'The most booked team member is {name} with {appointments} appointments and an appointment value of {value}.',
    noStaffData: 'There is not enough staff appointment activity in the selected period.',
    servicesLine: 'The most booked service is {name} with {bookings} bookings and {revenue} in recorded service revenue.',
    noServiceData: 'There is not enough service booking activity in the selected period.',
    inventoryLine: '{active} active products are recorded; {low} are at or below minimum stock and {out} are out of stock.',
    inventoryValue: 'Current stock cost value is {costValue} and estimated retail value is {retailValue}.',
    marketingLine: '{campaigns} campaigns are recorded in the period, with {sent} messages sent, {delivered} delivered and {converted} conversions.',
    marketingRates: 'Delivery rate is {deliveryRate}% and recorded conversion rate is {conversionRate}%. Attributed revenue is {revenue}.',
    supportLine: 'I can analyse live Velliqo business data for finance, appointments, customers, staff, services, inventory and marketing. I can compare periods, identify risks and opportunities, and direct you to the correct area for review. I do not use the public internet and I do not change business data.',
    causalLimit: 'The available data shows what changed, but it does not by itself prove the cause. The recommendation below is based on the strongest measurable signal.',
    recommendationPrefix: 'Recommended next step:',
    financeRecommendation: 'Review Finance and compare the daily performance, expenses and item mix before changing prices or budgets.',
    schedulingRecommendation: 'Review the calendar by day and staff member, then address recurring cancellation, no-show or unused-capacity patterns.',
    customersRecommendation: 'Review at-risk and dormant customer segments and prepare a consent-aware retention campaign.',
    staffRecommendation: 'Compare workload and completion rates across the team before redistributing appointments or working hours.',
    servicesRecommendation: 'Review service demand, value and duration before promoting, repricing or retiring a service.',
    inventoryRecommendation: 'Replenish out-of-stock items first and verify low-stock thresholds against actual product sales.',
    marketingRecommendation: 'Review campaign delivery and conversions before increasing audience size or switching to Live mode.',
    healthRecommendation: 'Start with the highest-severity insight and verify it in the linked Velliqo area.',
    insightRevenueUpTitle: 'Revenue momentum improved',
    insightRevenueUpExplanation: 'Collected revenue is higher than in the previous equivalent period.',
    insightRevenueDownTitle: 'Revenue declined',
    insightRevenueDownExplanation: 'Collected revenue is lower than in the previous equivalent period.',
    insightProfitTitle: 'Operating profit is negative',
    insightProfitExplanation: 'Recorded costs and paid expenses exceed the current net sales contribution.',
    insightCancellationTitle: 'Cancellation rate needs attention',
    insightCancellationExplanation: 'A material share of appointments did not proceed because they were cancelled.',
    insightNoShowTitle: 'No-shows are affecting capacity',
    insightNoShowExplanation: 'No-show appointments are consuming bookable capacity without completion.',
    insightRetentionTitle: 'Customer retention opportunity',
    insightRetentionExplanation: 'At-risk customers can be targeted with a measured re-engagement approach.',
    insightReturningTitle: 'Returning customer base is healthy',
    insightReturningExplanation: 'A meaningful share of customers have completed more than one visit.',
    insightOutOfStockTitle: 'Products are out of stock',
    insightOutOfStockExplanation: 'Some active products have no available stock.',
    insightLowStockTitle: 'Low-stock items require review',
    insightLowStockExplanation: 'Active products have reached or fallen below their minimum stock threshold.',
    insightMarketingTitle: 'Campaign conversion opportunity',
    insightMarketingExplanation: 'Messages are being delivered but recorded conversions remain limited.',
    insightServiceTitle: 'Leading service identified',
    insightServiceExplanation: 'One service currently leads recorded booking demand.',
    evidenceRevenue: 'Current revenue: {current}; previous period: {previous}.',
    evidenceProfit: 'Operating profit: {profit}; paid expenses: {expenses}.',
    evidenceCancellation: '{cancelled} cancellations from {total} appointments ({rate}%).',
    evidenceNoShow: '{noShows} no-shows from {total} appointments ({rate}%).',
    evidenceRetention: '{atRisk} at-risk and {dormant} dormant customers.',
    evidenceReturning: '{returning} returning customers ({rate}%).',
    evidenceInventory: '{out} out of stock and {low} at/below minimum stock.',
    evidenceMarketing: '{delivered} delivered messages and {converted} recorded conversions.',
    evidenceService: '{name}: {bookings} bookings and {revenue} revenue.',
    actionFinanceTitle: 'Open Finance',
    actionFinanceReason: 'Verify revenue, profit, expenses and daily performance.',
    actionCalendarTitle: 'Open Calendar',
    actionCalendarReason: 'Review appointment demand, cancellations and staff capacity.',
    actionCustomersTitle: 'Open Customers',
    actionCustomersReason: 'Review retention, at-risk and dormant customer segments.',
    actionStaffTitle: 'Open Staff',
    actionStaffReason: 'Compare workload and team performance.',
    actionServicesTitle: 'Open Services',
    actionServicesReason: 'Review demand, duration and service value.',
    actionInventoryTitle: 'Open Products',
    actionInventoryReason: 'Review low stock, out-of-stock items and stock value.',
    actionMarketingTitle: 'Open Marketing',
    actionMarketingReason: 'Review campaigns, delivery and conversion performance.',
    actionReportsTitle: 'Open Reports',
    actionReportsReason: 'Validate the wider business trend across reporting views.',
    followFinance: 'Which revenue or profit metric should we examine next?',
    followCustomers: 'Should I focus on returning, at-risk or dormant customers?',
    followScheduling: 'Should I focus on cancellations, no-shows or upcoming capacity?',
    followStaff: 'Should I compare team workload or completion rates?',
    followServices: 'Should I compare service demand, revenue or average value?',
    followInventory: 'Should I focus on out-of-stock items or total stock value?',
    followMarketing: 'Should I focus on delivery, conversion or attributed revenue?',
    followHealth: 'Which area should I analyse in more detail?',
  },
  el: {
    healthExcellent: 'Η υγεία της επιχείρησης είναι ισχυρή και οι βασικοί δείκτες παραμένουν σταθεροί.',
    healthGood: 'Η υγεία της επιχείρησης είναι γενικά καλή, με ορισμένα σημεία που αξίζει να ελεγχθούν.',
    healthWatch: 'Η υγεία της επιχείρησης χρειάζεται προσοχή, επειδή αρκετοί δείκτες βρίσκονται υπό πίεση.',
    healthCritical: 'Η κατάσταση της επιχείρησης απαιτεί άμεσο έλεγχο των σημαντικότερων προειδοποιητικών δεικτών.',
    healthScore: 'Η υπολογισμένη βαθμολογία υγείας είναι {score}/100 για τις τελευταίες {days} ημέρες.',
    noData: 'Δεν υπάρχει ακόμη αρκετή καταγεγραμμένη δραστηριότητα για αξιολόγηση υψηλής βεβαιότητας.',
    revenueLine: 'Τα εισπραγμένα έσοδα είναι {revenue} από {transactions} ολοκληρωμένες πωλήσεις τις τελευταίες {days} ημέρες.',
    revenueUp: 'Τα έσοδα αυξήθηκαν κατά {change}% σε σύγκριση με την προηγούμενη αντίστοιχη περίοδο.',
    revenueDown: 'Τα έσοδα μειώθηκαν κατά {change}% σε σύγκριση με την προηγούμενη αντίστοιχη περίοδο.',
    revenueFlat: 'Τα έσοδα παραμένουν γενικά σταθερά σε σύγκριση με την προηγούμενη περίοδο ({change}%).',
    revenueNoComparison: 'Δεν υπάρχουν αρκετά έσοδα στην προηγούμενη περίοδο για αξιόπιστη ποσοστιαία σύγκριση.',
    profitLine: 'Το λειτουργικό κέρδος είναι {profit}, τα πληρωμένα έξοδα {expenses} και το μικτό περιθώριο {margin}%.',
    averageTicket: 'Η μέση αξία συναλλαγής είναι {ticket}.',
    schedulingLine: 'Καταγράφηκαν {total} ραντεβού: {completed} ολοκληρώθηκαν, {cancelled} ακυρώθηκαν και {noShows} ήταν no-show.',
    schedulingRates: 'Το ποσοστό ολοκλήρωσης είναι {completion}%, ακυρώσεων {cancellation}% και no-show {noShow}%.',
    upcomingLine: 'Υπάρχουν {count} προγραμματισμένα ραντεβού για τις επόμενες επτά ημέρες.',
    customersLine: 'Η επιχείρηση έχει {total} πελάτες, από τους οποίους {newCount} προστέθηκαν σε αυτή την περίοδο.',
    retentionLine: '{returning} πελάτες έχουν επιστρέψει τουλάχιστον μία φορά ({rate}% ποσοστό επιστροφής), ενώ {atRisk} βρίσκονται σε κίνδυνο αδράνειας.',
    staffLine: 'Το μέλος προσωπικού με τις περισσότερες κρατήσεις είναι ο/η {name}, με {appointments} ραντεβού και αξία ραντεβού {value}.',
    noStaffData: 'Δεν υπάρχει αρκετή δραστηριότητα ραντεβού ανά προσωπικό στην επιλεγμένη περίοδο.',
    servicesLine: 'Η υπηρεσία με τις περισσότερες κρατήσεις είναι «{name}», με {bookings} κρατήσεις και {revenue} καταγεγραμμένα έσοδα υπηρεσίας.',
    noServiceData: 'Δεν υπάρχει αρκετή δραστηριότητα κρατήσεων υπηρεσιών στην επιλεγμένη περίοδο.',
    inventoryLine: 'Υπάρχουν {active} ενεργά προϊόντα· {low} βρίσκονται στο ή κάτω από το ελάχιστο απόθεμα και {out} είναι εξαντλημένα.',
    inventoryValue: 'Η τρέχουσα αξία κόστους αποθέματος είναι {costValue} και η εκτιμώμενη λιανική αξία {retailValue}.',
    marketingLine: 'Καταγράφηκαν {campaigns} campaigns στην περίοδο, με {sent} αποστολές, {delivered} παραδόσεις και {converted} μετατροπές.',
    marketingRates: 'Το ποσοστό παράδοσης είναι {deliveryRate}% και το καταγεγραμμένο ποσοστό μετατροπής {conversionRate}%. Τα αποδιδόμενα έσοδα είναι {revenue}.',
    supportLine: 'Μπορώ να αναλύω τα ζωντανά δεδομένα του Velliqo για οικονομικά, ραντεβού, πελάτες, προσωπικό, υπηρεσίες, απόθεμα και marketing. Μπορώ να συγκρίνω περιόδους, να εντοπίζω κινδύνους και ευκαιρίες και να σας οδηγώ στη σωστή ενότητα για έλεγχο. Δεν χρησιμοποιώ το δημόσιο διαδίκτυο και δεν αλλάζω δεδομένα της επιχείρησης.',
    causalLimit: 'Τα διαθέσιμα δεδομένα δείχνουν τι άλλαξε, αλλά δεν αποδεικνύουν από μόνα τους την αιτία. Η παρακάτω πρόταση βασίζεται στο ισχυρότερο μετρήσιμο στοιχείο.',
    recommendationPrefix: 'Προτεινόμενο επόμενο βήμα:',
    financeRecommendation: 'Ελέγξτε τα Οικονομικά και συγκρίνετε ημερήσια απόδοση, έξοδα και μίγμα πωλήσεων πριν αλλάξετε τιμές ή προϋπολογισμούς.',
    schedulingRecommendation: 'Ελέγξτε το ημερολόγιο ανά ημέρα και μέλος προσωπικού και αντιμετωπίστε επαναλαμβανόμενες ακυρώσεις, no-show ή ανεκμετάλλευτη χωρητικότητα.',
    customersRecommendation: 'Ελέγξτε τους πελάτες σε κίνδυνο και τους ανενεργούς και ετοιμάστε καμπάνια επαναπροσέγγισης με συγκατάθεση.',
    staffRecommendation: 'Συγκρίνετε φόρτο εργασίας και ποσοστά ολοκλήρωσης πριν ανακατανείμετε ραντεβού ή ώρες εργασίας.',
    servicesRecommendation: 'Ελέγξτε ζήτηση, αξία και διάρκεια υπηρεσιών πριν προωθήσετε, ανατιμολογήσετε ή καταργήσετε υπηρεσία.',
    inventoryRecommendation: 'Αναπληρώστε πρώτα τα εξαντλημένα προϊόντα και επιβεβαιώστε τα όρια χαμηλού αποθέματος με βάση τις πραγματικές πωλήσεις.',
    marketingRecommendation: 'Ελέγξτε την παράδοση και τις μετατροπές των campaigns πριν αυξήσετε το κοινό ή ενεργοποιήσετε Live mode.',
    healthRecommendation: 'Ξεκινήστε από το insight με τη μεγαλύτερη σοβαρότητα και επιβεβαιώστε το στη συνδεδεμένη ενότητα του Velliqo.',
    insightRevenueUpTitle: 'Βελτιωμένη δυναμική εσόδων',
    insightRevenueUpExplanation: 'Τα εισπραγμένα έσοδα είναι υψηλότερα από την προηγούμενη αντίστοιχη περίοδο.',
    insightRevenueDownTitle: 'Μείωση εσόδων',
    insightRevenueDownExplanation: 'Τα εισπραγμένα έσοδα είναι χαμηλότερα από την προηγούμενη αντίστοιχη περίοδο.',
    insightProfitTitle: 'Αρνητικό λειτουργικό κέρδος',
    insightProfitExplanation: 'Το καταγεγραμμένο κόστος και τα πληρωμένα έξοδα υπερβαίνουν τη συνεισφορά των καθαρών πωλήσεων.',
    insightCancellationTitle: 'Το ποσοστό ακυρώσεων χρειάζεται προσοχή',
    insightCancellationExplanation: 'Σημαντικό μέρος των ραντεβού δεν πραγματοποιήθηκε λόγω ακύρωσης.',
    insightNoShowTitle: 'Τα no-show επηρεάζουν τη χωρητικότητα',
    insightNoShowExplanation: 'Τα no-show δεσμεύουν διαθέσιμο χρόνο χωρίς ολοκλήρωση ραντεβού.',
    insightRetentionTitle: 'Ευκαιρία διατήρησης πελατών',
    insightRetentionExplanation: 'Οι πελάτες σε κίνδυνο μπορούν να προσεγγιστούν με μετρημένη καμπάνια επανενεργοποίησης.',
    insightReturningTitle: 'Υγιής βάση επαναλαμβανόμενων πελατών',
    insightReturningExplanation: 'Σημαντικό ποσοστό πελατών έχει ολοκληρώσει περισσότερες από μία επισκέψεις.',
    insightOutOfStockTitle: 'Υπάρχουν εξαντλημένα προϊόντα',
    insightOutOfStockExplanation: 'Ορισμένα ενεργά προϊόντα δεν έχουν διαθέσιμο απόθεμα.',
    insightLowStockTitle: 'Απαιτείται έλεγχος χαμηλού αποθέματος',
    insightLowStockExplanation: 'Ενεργά προϊόντα έφτασαν ή έπεσαν κάτω από το ελάχιστο όριο αποθέματος.',
    insightMarketingTitle: 'Ευκαιρία βελτίωσης μετατροπών',
    insightMarketingExplanation: 'Τα μηνύματα παραδίδονται, αλλά οι καταγεγραμμένες μετατροπές παραμένουν περιορισμένες.',
    insightServiceTitle: 'Εντοπίστηκε η κορυφαία υπηρεσία',
    insightServiceExplanation: 'Μία υπηρεσία προηγείται στην καταγεγραμμένη ζήτηση κρατήσεων.',
    evidenceRevenue: 'Τρέχοντα έσοδα: {current}· προηγούμενη περίοδος: {previous}.',
    evidenceProfit: 'Λειτουργικό κέρδος: {profit}· πληρωμένα έξοδα: {expenses}.',
    evidenceCancellation: '{cancelled} ακυρώσεις από {total} ραντεβού ({rate}%).',
    evidenceNoShow: '{noShows} no-show από {total} ραντεβού ({rate}%).',
    evidenceRetention: '{atRisk} πελάτες σε κίνδυνο και {dormant} ανενεργοί.',
    evidenceReturning: '{returning} επαναλαμβανόμενοι πελάτες ({rate}%).',
    evidenceInventory: '{out} εξαντλημένα και {low} στο/κάτω από το ελάχιστο απόθεμα.',
    evidenceMarketing: '{delivered} παραδομένα μηνύματα και {converted} καταγεγραμμένες μετατροπές.',
    evidenceService: '{name}: {bookings} κρατήσεις και {revenue} έσοδα.',
    actionFinanceTitle: 'Άνοιγμα Οικονομικών',
    actionFinanceReason: 'Επιβεβαιώστε έσοδα, κέρδος, έξοδα και ημερήσια απόδοση.',
    actionCalendarTitle: 'Άνοιγμα Ημερολογίου',
    actionCalendarReason: 'Ελέγξτε ζήτηση ραντεβού, ακυρώσεις και χωρητικότητα προσωπικού.',
    actionCustomersTitle: 'Άνοιγμα Πελατών',
    actionCustomersReason: 'Ελέγξτε διατήρηση, πελάτες σε κίνδυνο και ανενεργούς.',
    actionStaffTitle: 'Άνοιγμα Προσωπικού',
    actionStaffReason: 'Συγκρίνετε φόρτο και απόδοση ομάδας.',
    actionServicesTitle: 'Άνοιγμα Υπηρεσιών',
    actionServicesReason: 'Ελέγξτε ζήτηση, διάρκεια και αξία υπηρεσιών.',
    actionInventoryTitle: 'Άνοιγμα Προϊόντων',
    actionInventoryReason: 'Ελέγξτε χαμηλό απόθεμα, εξαντλημένα προϊόντα και αξία αποθέματος.',
    actionMarketingTitle: 'Άνοιγμα Marketing',
    actionMarketingReason: 'Ελέγξτε campaigns, παραδόσεις και μετατροπές.',
    actionReportsTitle: 'Άνοιγμα Αναφορών',
    actionReportsReason: 'Επιβεβαιώστε τη συνολική τάση μέσα από τις αναφορές.',
    followFinance: 'Ποιον δείκτη εσόδων ή κέρδους να εξετάσουμε στη συνέχεια;',
    followCustomers: 'Να εστιάσω σε επαναλαμβανόμενους, σε κίνδυνο ή ανενεργούς πελάτες;',
    followScheduling: 'Να εστιάσω σε ακυρώσεις, no-show ή επερχόμενη χωρητικότητα;',
    followStaff: 'Να συγκρίνω φόρτο ομάδας ή ποσοστά ολοκλήρωσης;',
    followServices: 'Να συγκρίνω ζήτηση, έσοδα ή μέση αξία υπηρεσιών;',
    followInventory: 'Να εστιάσω στα εξαντλημένα προϊόντα ή στη συνολική αξία αποθέματος;',
    followMarketing: 'Να εστιάσω στην παράδοση, τις μετατροπές ή τα αποδιδόμενα έσοδα;',
    followHealth: 'Ποια ενότητα να αναλύσω πιο αναλυτικά;',
  },
  de: {
    healthExcellent: 'Die Geschäftslage ist stark und die wichtigsten Kennzahlen sind stabil.',
    healthGood: 'Die Geschäftslage ist insgesamt gut, mit einigen Bereichen, die geprüft werden sollten.',
    healthWatch: 'Die Geschäftslage benötigt Aufmerksamkeit, da mehrere Kennzahlen unter Druck stehen.',
    healthCritical: 'Die Geschäftslage erfordert eine sofortige Prüfung der wichtigsten Warnsignale.',
    healthScore: 'Der berechnete Gesundheitswert beträgt {score}/100 für die letzten {days} Tage.',
    noData: 'Es gibt noch nicht genügend erfasste Aktivität für eine Bewertung mit hoher Sicherheit.',
    revenueLine: 'Der vereinnahmte Umsatz beträgt {revenue} aus {transactions} abgeschlossenen Verkäufen in den letzten {days} Tagen.',
    revenueUp: 'Der Umsatz stieg gegenüber dem vorherigen Vergleichszeitraum um {change}%.',
    revenueDown: 'Der Umsatz sank gegenüber dem vorherigen Vergleichszeitraum um {change}%.',
    revenueFlat: 'Der Umsatz ist gegenüber dem vorherigen Vergleichszeitraum weitgehend stabil ({change}%).',
    revenueNoComparison: 'Im vorherigen Zeitraum gibt es nicht genügend Umsatz für einen zuverlässigen Prozentvergleich.',
    profitLine: 'Der Betriebsgewinn beträgt {profit}, bezahlte Ausgaben {expenses} und die Bruttomarge {margin}%.',
    averageTicket: 'Der durchschnittliche Transaktionswert beträgt {ticket}.',
    schedulingLine: 'Es gab {total} Termine: {completed} abgeschlossen, {cancelled} storniert und {noShows} No-Shows.',
    schedulingRates: 'Abschlussquote: {completion}%, Stornoquote: {cancellation}%, No-Show-Quote: {noShow}%.',
    upcomingLine: 'Für die nächsten sieben Tage sind derzeit {count} Termine geplant.',
    customersLine: 'Das Unternehmen hat {total} Kunden, darunter {newCount} neue Kunden in diesem Zeitraum.',
    retentionLine: '{returning} Kunden sind mindestens einmal zurückgekehrt ({rate}% Rückkehrquote), während {atRisk} derzeit inaktivitätsgefährdet sind.',
    staffLine: 'Das meistgebuchte Teammitglied ist {name} mit {appointments} Terminen und einem Terminwert von {value}.',
    noStaffData: 'Im gewählten Zeitraum gibt es nicht genügend Terminaktivität pro Mitarbeiter.',
    servicesLine: 'Die meistgebuchte Leistung ist „{name}“ mit {bookings} Buchungen und {revenue} erfasstem Leistungsumsatz.',
    noServiceData: 'Im gewählten Zeitraum gibt es nicht genügend Leistungsbuchungen.',
    inventoryLine: '{active} aktive Produkte sind erfasst; {low} liegen am oder unter dem Mindestbestand und {out} sind ausverkauft.',
    inventoryValue: 'Der aktuelle Einstandswert des Bestands beträgt {costValue}, der geschätzte Verkaufswert {retailValue}.',
    marketingLine: '{campaigns} Kampagnen wurden im Zeitraum erfasst, mit {sent} gesendeten, {delivered} zugestellten Nachrichten und {converted} Conversions.',
    marketingRates: 'Die Zustellrate beträgt {deliveryRate}% und die erfasste Conversion-Rate {conversionRate}%. Zugeordneter Umsatz: {revenue}.',
    supportLine: 'Ich analysiere Live-Daten aus Velliqo zu Finanzen, Terminen, Kunden, Team, Leistungen, Bestand und Marketing. Ich kann Zeiträume vergleichen, Risiken und Chancen erkennen und zum richtigen Prüfbereich führen. Ich nutze nicht das öffentliche Internet und ändere keine Geschäftsdaten.',
    causalLimit: 'Die verfügbaren Daten zeigen, was sich verändert hat, beweisen aber nicht allein die Ursache. Die Empfehlung basiert auf dem stärksten messbaren Signal.',
    recommendationPrefix: 'Empfohlener nächster Schritt:',
    financeRecommendation: 'Finanzen öffnen und Tagesleistung, Ausgaben und Artikelmix prüfen, bevor Preise oder Budgets geändert werden.',
    schedulingRecommendation: 'Kalender nach Tag und Mitarbeiter prüfen und wiederkehrende Stornos, No-Shows oder ungenutzte Kapazität bearbeiten.',
    customersRecommendation: 'Gefährdete und inaktive Kundensegmente prüfen und eine einwilligungsbasierte Reaktivierung vorbereiten.',
    staffRecommendation: 'Arbeitslast und Abschlussquoten vergleichen, bevor Termine oder Arbeitszeiten neu verteilt werden.',
    servicesRecommendation: 'Nachfrage, Wert und Dauer prüfen, bevor Leistungen beworben, neu bepreist oder entfernt werden.',
    inventoryRecommendation: 'Ausverkaufte Produkte zuerst auffüllen und Mindestbestände anhand tatsächlicher Verkäufe prüfen.',
    marketingRecommendation: 'Zustellung und Conversions prüfen, bevor Zielgruppen vergrößert oder der Live-Modus aktiviert wird.',
    healthRecommendation: 'Mit dem schwerwiegendsten Insight beginnen und ihn im verknüpften Velliqo-Bereich verifizieren.',
    insightRevenueUpTitle: 'Umsatzdynamik verbessert', insightRevenueUpExplanation: 'Der vereinnahmte Umsatz liegt über dem vorherigen Vergleichszeitraum.',
    insightRevenueDownTitle: 'Umsatz gesunken', insightRevenueDownExplanation: 'Der vereinnahmte Umsatz liegt unter dem vorherigen Vergleichszeitraum.',
    insightProfitTitle: 'Negativer Betriebsgewinn', insightProfitExplanation: 'Erfasste Kosten und bezahlte Ausgaben übersteigen den Beitrag aus Nettoumsätzen.',
    insightCancellationTitle: 'Stornoquote benötigt Aufmerksamkeit', insightCancellationExplanation: 'Ein relevanter Anteil der Termine fand wegen Stornierung nicht statt.',
    insightNoShowTitle: 'No-Shows belasten Kapazität', insightNoShowExplanation: 'No-Shows blockieren buchbare Zeit ohne Abschluss.',
    insightRetentionTitle: 'Chance zur Kundenbindung', insightRetentionExplanation: 'Gefährdete Kunden können gezielt und maßvoll reaktiviert werden.',
    insightReturningTitle: 'Gesunde Stammkundenbasis', insightReturningExplanation: 'Ein relevanter Anteil der Kunden hat mehr als einen Besuch abgeschlossen.',
    insightOutOfStockTitle: 'Produkte sind ausverkauft', insightOutOfStockExplanation: 'Einige aktive Produkte haben keinen verfügbaren Bestand.',
    insightLowStockTitle: 'Niedrige Bestände prüfen', insightLowStockExplanation: 'Aktive Produkte haben den Mindestbestand erreicht oder unterschritten.',
    insightMarketingTitle: 'Chance zur Conversion-Optimierung', insightMarketingExplanation: 'Nachrichten werden zugestellt, aber erfasste Conversions bleiben begrenzt.',
    insightServiceTitle: 'Führende Leistung erkannt', insightServiceExplanation: 'Eine Leistung führt derzeit die erfasste Buchungsnachfrage an.',
    evidenceRevenue: 'Aktueller Umsatz: {current}; vorheriger Zeitraum: {previous}.',
    evidenceProfit: 'Betriebsgewinn: {profit}; bezahlte Ausgaben: {expenses}.',
    evidenceCancellation: '{cancelled} Stornos aus {total} Terminen ({rate}%).',
    evidenceNoShow: '{noShows} No-Shows aus {total} Terminen ({rate}%).',
    evidenceRetention: '{atRisk} gefährdete und {dormant} inaktive Kunden.',
    evidenceReturning: '{returning} wiederkehrende Kunden ({rate}%).',
    evidenceInventory: '{out} ausverkauft und {low} am/unter Mindestbestand.',
    evidenceMarketing: '{delivered} zugestellte Nachrichten und {converted} erfasste Conversions.',
    evidenceService: '{name}: {bookings} Buchungen und {revenue} Umsatz.',
    actionFinanceTitle: 'Finanzen öffnen', actionFinanceReason: 'Umsatz, Gewinn, Ausgaben und Tagesleistung prüfen.',
    actionCalendarTitle: 'Kalender öffnen', actionCalendarReason: 'Terminnachfrage, Stornos und Teamkapazität prüfen.',
    actionCustomersTitle: 'Kunden öffnen', actionCustomersReason: 'Bindung, gefährdete und inaktive Kundensegmente prüfen.',
    actionStaffTitle: 'Team öffnen', actionStaffReason: 'Arbeitslast und Teamleistung vergleichen.',
    actionServicesTitle: 'Leistungen öffnen', actionServicesReason: 'Nachfrage, Dauer und Leistungswert prüfen.',
    actionInventoryTitle: 'Produkte öffnen', actionInventoryReason: 'Niedrige Bestände, Ausverkauf und Bestandswert prüfen.',
    actionMarketingTitle: 'Marketing öffnen', actionMarketingReason: 'Kampagnen, Zustellung und Conversions prüfen.',
    actionReportsTitle: 'Berichte öffnen', actionReportsReason: 'Den Gesamttrend in den Berichten validieren.',
    followFinance: 'Welche Umsatz- oder Gewinnkennzahl soll ich als Nächstes prüfen?',
    followCustomers: 'Soll ich wiederkehrende, gefährdete oder inaktive Kunden fokussieren?',
    followScheduling: 'Soll ich Stornos, No-Shows oder kommende Kapazität fokussieren?',
    followStaff: 'Soll ich Arbeitslast oder Abschlussquoten vergleichen?',
    followServices: 'Soll ich Nachfrage, Umsatz oder Durchschnittswert vergleichen?',
    followInventory: 'Soll ich Ausverkauf oder gesamten Bestandswert fokussieren?',
    followMarketing: 'Soll ich Zustellung, Conversion oder zugeordneten Umsatz fokussieren?',
    followHealth: 'Welchen Bereich soll ich detaillierter analysieren?',
  },
  es: {
    healthExcellent: 'La salud del negocio es sólida y los principales indicadores están estables.',
    healthGood: 'La salud del negocio es generalmente buena, con algunas áreas que conviene revisar.',
    healthWatch: 'La salud del negocio necesita atención porque varios indicadores están bajo presión.',
    healthCritical: 'La salud del negocio requiere una revisión inmediata de los indicadores de alerta más importantes.',
    healthScore: 'La puntuación calculada de salud es {score}/100 para los últimos {days} días.',
    noData: 'Todavía no hay suficiente actividad registrada para una evaluación de alta confianza.',
    revenueLine: 'Los ingresos cobrados son {revenue} de {transactions} ventas completadas durante los últimos {days} días.',
    revenueUp: 'Los ingresos aumentaron un {change}% frente al período equivalente anterior.',
    revenueDown: 'Los ingresos disminuyeron un {change}% frente al período equivalente anterior.',
    revenueFlat: 'Los ingresos se mantienen en general estables frente al período anterior ({change}%).',
    revenueNoComparison: 'No hay suficientes ingresos en el período anterior para una comparación porcentual fiable.',
    profitLine: 'El beneficio operativo es {profit}, los gastos pagados {expenses} y el margen bruto {margin}%.',
    averageTicket: 'El valor medio por transacción es {ticket}.',
    schedulingLine: 'Hubo {total} citas: {completed} completadas, {cancelled} canceladas y {noShows} ausencias.',
    schedulingRates: 'La tasa de finalización es {completion}%, cancelación {cancellation}% y ausencias {noShow}%.',
    upcomingLine: 'Hay {count} citas programadas para los próximos siete días.',
    customersLine: 'El negocio tiene {total} clientes, incluidos {newCount} nuevos en este período.',
    retentionLine: '{returning} clientes han vuelto al menos una vez ({rate}% de retorno), mientras {atRisk} están en riesgo de inactividad.',
    staffLine: 'El miembro del equipo con más reservas es {name}, con {appointments} citas y un valor de {value}.',
    noStaffData: 'No hay suficiente actividad de citas por equipo en el período seleccionado.',
    servicesLine: 'El servicio más reservado es «{name}», con {bookings} reservas y {revenue} de ingresos registrados.',
    noServiceData: 'No hay suficiente actividad de reservas de servicios en el período seleccionado.',
    inventoryLine: 'Hay {active} productos activos; {low} están en o por debajo del mínimo y {out} agotados.',
    inventoryValue: 'El valor de coste del stock es {costValue} y el valor minorista estimado {retailValue}.',
    marketingLine: 'Se registraron {campaigns} campañas en el período, con {sent} envíos, {delivered} entregas y {converted} conversiones.',
    marketingRates: 'La tasa de entrega es {deliveryRate}% y la conversión registrada {conversionRate}%. Ingresos atribuidos: {revenue}.',
    supportLine: 'Puedo analizar datos en vivo de Velliqo sobre finanzas, citas, clientes, equipo, servicios, inventario y marketing. Puedo comparar períodos, detectar riesgos y oportunidades y dirigirte al área correcta. No uso internet público ni modifico datos del negocio.',
    causalLimit: 'Los datos disponibles muestran qué cambió, pero por sí solos no demuestran la causa. La recomendación se basa en la señal medible más fuerte.',
    recommendationPrefix: 'Siguiente paso recomendado:',
    financeRecommendation: 'Revisa Finanzas y compara rendimiento diario, gastos y mezcla de ventas antes de cambiar precios o presupuestos.',
    schedulingRecommendation: 'Revisa el calendario por día y miembro del equipo y aborda cancelaciones, ausencias o capacidad sin usar.',
    customersRecommendation: 'Revisa clientes en riesgo e inactivos y prepara una campaña de reactivación con consentimiento.',
    staffRecommendation: 'Compara carga y tasas de finalización antes de redistribuir citas u horarios.',
    servicesRecommendation: 'Revisa demanda, valor y duración antes de promocionar, cambiar precio o retirar un servicio.',
    inventoryRecommendation: 'Repón primero productos agotados y valida mínimos con ventas reales.',
    marketingRecommendation: 'Revisa entregas y conversiones antes de ampliar audiencia o activar Live mode.',
    healthRecommendation: 'Empieza por el insight de mayor gravedad y valídalo en el área enlazada de Velliqo.',
    insightRevenueUpTitle: 'Mejoró el impulso de ingresos', insightRevenueUpExplanation: 'Los ingresos cobrados superan el período equivalente anterior.',
    insightRevenueDownTitle: 'Descenso de ingresos', insightRevenueDownExplanation: 'Los ingresos cobrados están por debajo del período equivalente anterior.',
    insightProfitTitle: 'Beneficio operativo negativo', insightProfitExplanation: 'Costes y gastos pagados superan la contribución de ventas netas.',
    insightCancellationTitle: 'La cancelación necesita atención', insightCancellationExplanation: 'Una parte material de las citas no se realizó por cancelación.',
    insightNoShowTitle: 'Las ausencias afectan la capacidad', insightNoShowExplanation: 'Las ausencias ocupan tiempo reservable sin finalización.',
    insightRetentionTitle: 'Oportunidad de retención', insightRetentionExplanation: 'Los clientes en riesgo pueden reactivarse de forma medida.',
    insightReturningTitle: 'Base saludable de clientes recurrentes', insightReturningExplanation: 'Una proporción relevante completó más de una visita.',
    insightOutOfStockTitle: 'Hay productos agotados', insightOutOfStockExplanation: 'Algunos productos activos no tienen stock disponible.',
    insightLowStockTitle: 'Revisar stock bajo', insightLowStockExplanation: 'Productos activos alcanzaron o bajaron del mínimo.',
    insightMarketingTitle: 'Oportunidad de conversión', insightMarketingExplanation: 'Los mensajes se entregan, pero las conversiones registradas siguen limitadas.',
    insightServiceTitle: 'Servicio líder identificado', insightServiceExplanation: 'Un servicio lidera la demanda registrada de reservas.',
    evidenceRevenue: 'Ingresos actuales: {current}; período anterior: {previous}.',
    evidenceProfit: 'Beneficio operativo: {profit}; gastos pagados: {expenses}.',
    evidenceCancellation: '{cancelled} cancelaciones de {total} citas ({rate}%).',
    evidenceNoShow: '{noShows} ausencias de {total} citas ({rate}%).',
    evidenceRetention: '{atRisk} clientes en riesgo y {dormant} inactivos.',
    evidenceReturning: '{returning} clientes recurrentes ({rate}%).',
    evidenceInventory: '{out} agotados y {low} en/debajo del mínimo.',
    evidenceMarketing: '{delivered} mensajes entregados y {converted} conversiones registradas.',
    evidenceService: '{name}: {bookings} reservas y {revenue} de ingresos.',
    actionFinanceTitle: 'Abrir Finanzas', actionFinanceReason: 'Verificar ingresos, beneficio, gastos y rendimiento diario.',
    actionCalendarTitle: 'Abrir Calendario', actionCalendarReason: 'Revisar demanda, cancelaciones y capacidad del equipo.',
    actionCustomersTitle: 'Abrir Clientes', actionCustomersReason: 'Revisar retención, clientes en riesgo e inactivos.',
    actionStaffTitle: 'Abrir Equipo', actionStaffReason: 'Comparar carga y rendimiento del equipo.',
    actionServicesTitle: 'Abrir Servicios', actionServicesReason: 'Revisar demanda, duración y valor.',
    actionInventoryTitle: 'Abrir Productos', actionInventoryReason: 'Revisar stock bajo, agotados y valor de inventario.',
    actionMarketingTitle: 'Abrir Marketing', actionMarketingReason: 'Revisar campañas, entregas y conversiones.',
    actionReportsTitle: 'Abrir Informes', actionReportsReason: 'Validar la tendencia general en informes.',
    followFinance: '¿Qué métrica de ingresos o beneficio revisamos ahora?',
    followCustomers: '¿Me centro en clientes recurrentes, en riesgo o inactivos?',
    followScheduling: '¿Me centro en cancelaciones, ausencias o capacidad próxima?',
    followStaff: '¿Comparo carga o tasas de finalización?',
    followServices: '¿Comparo demanda, ingresos o valor medio?',
    followInventory: '¿Me centro en agotados o valor total del stock?',
    followMarketing: '¿Me centro en entrega, conversión o ingresos atribuidos?',
    followHealth: '¿Qué área analizo con más detalle?',
  },
  tr: {
    healthExcellent: 'İşletme sağlığı güçlü ve ana göstergeler istikrarlı.',
    healthGood: 'İşletme sağlığı genel olarak iyi; incelenmesi gereken birkaç alan var.',
    healthWatch: 'Birden fazla gösterge baskı altında olduğu için işletme sağlığı dikkat gerektiriyor.',
    healthCritical: 'İşletme sağlığı, en önemli uyarı göstergelerinin hemen incelenmesini gerektiriyor.',
    healthScore: 'Son {days} gün için hesaplanan işletme sağlık puanı {score}/100.',
    noData: 'Yüksek güvenli değerlendirme için henüz yeterli kayıtlı faaliyet yok.',
    revenueLine: 'Son {days} günde {transactions} tamamlanan satıştan tahsil edilen gelir {revenue}.',
    revenueUp: 'Gelir önceki eşdeğer döneme göre %{change} arttı.',
    revenueDown: 'Gelir önceki eşdeğer döneme göre %{change} azaldı.',
    revenueFlat: 'Gelir önceki eşdeğer döneme göre büyük ölçüde sabit (%{change}).',
    revenueNoComparison: 'Önceki dönemde güvenilir yüzde karşılaştırması için yeterli gelir yok.',
    profitLine: 'Faaliyet kârı {profit}, ödenmiş giderler {expenses} ve brüt marj %{margin}.',
    averageTicket: 'Ortalama işlem değeri {ticket}.',
    schedulingLine: '{total} randevu vardı: {completed} tamamlandı, {cancelled} iptal ve {noShows} no-show.',
    schedulingRates: 'Tamamlanma %{completion}, iptal %{cancellation}, no-show %{noShow}.',
    upcomingLine: 'Önümüzdeki yedi gün için {count} randevu planlı.',
    customersLine: 'İşletmede {total} müşteri var; bu dönemde {newCount} yeni müşteri eklendi.',
    retentionLine: '{returning} müşteri en az bir kez geri döndü (%{rate}); {atRisk} müşteri ise hareketsizlik riski taşıyor.',
    staffLine: 'En çok rezervasyon alan ekip üyesi {name}: {appointments} randevu ve {value} randevu değeri.',
    noStaffData: 'Seçilen dönemde ekip bazında yeterli randevu faaliyeti yok.',
    servicesLine: 'En çok rezervasyon alan hizmet “{name}”: {bookings} rezervasyon ve {revenue} kayıtlı hizmet geliri.',
    noServiceData: 'Seçilen dönemde yeterli hizmet rezervasyonu faaliyeti yok.',
    inventoryLine: '{active} aktif ürün kayıtlı; {low} minimumda/altında ve {out} stokta yok.',
    inventoryValue: 'Mevcut stok maliyet değeri {costValue}, tahmini perakende değeri {retailValue}.',
    marketingLine: 'Dönemde {campaigns} kampanya kaydedildi; {sent} gönderim, {delivered} teslimat ve {converted} dönüşüm.',
    marketingRates: 'Teslimat oranı %{deliveryRate}, kayıtlı dönüşüm oranı %{conversionRate}. Atfedilen gelir {revenue}.',
    supportLine: 'Velliqo içindeki finans, randevu, müşteri, ekip, hizmet, stok ve marketing verilerini analiz edebilirim. Dönemleri karşılaştırır, risk ve fırsatları belirler ve doğru inceleme alanına yönlendiririm. Açık interneti kullanmam ve işletme verilerini değiştirmem.',
    causalLimit: 'Mevcut veriler neyin değiştiğini gösterir, ancak nedeni tek başına kanıtlamaz. Öneri en güçlü ölçülebilir sinyale dayanır.',
    recommendationPrefix: 'Önerilen sonraki adım:',
    financeRecommendation: 'Fiyat veya bütçe değiştirmeden önce Finans alanında günlük performans, giderler ve satış karmasını karşılaştırın.',
    schedulingRecommendation: 'Takvimi gün ve ekip üyesi bazında inceleyip tekrar eden iptal, no-show veya kullanılmayan kapasiteyi ele alın.',
    customersRecommendation: 'Riskli ve pasif müşteri segmentlerini inceleyip izinli bir yeniden etkileşim kampanyası hazırlayın.',
    staffRecommendation: 'Randevu veya çalışma saatlerini dağıtmadan önce iş yükü ve tamamlanma oranlarını karşılaştırın.',
    servicesRecommendation: 'Bir hizmeti tanıtmadan, fiyatını değiştirmeden veya kaldırmadan önce talep, değer ve süreyi inceleyin.',
    inventoryRecommendation: 'Önce stokta olmayan ürünleri tamamlayın ve minimum seviyeleri gerçek satışlarla doğrulayın.',
    marketingRecommendation: 'Kitleyi büyütmeden veya Live mode açmadan önce teslimat ve dönüşümleri inceleyin.',
    healthRecommendation: 'En yüksek önem derecesindeki insight ile başlayın ve bağlı Velliqo alanında doğrulayın.',
    insightRevenueUpTitle: 'Gelir ivmesi iyileşti', insightRevenueUpExplanation: 'Tahsil edilen gelir önceki eşdeğer dönemden yüksek.',
    insightRevenueDownTitle: 'Gelir azaldı', insightRevenueDownExplanation: 'Tahsil edilen gelir önceki eşdeğer dönemden düşük.',
    insightProfitTitle: 'Faaliyet kârı negatif', insightProfitExplanation: 'Kayıtlı maliyet ve ödenen giderler net satış katkısını aşıyor.',
    insightCancellationTitle: 'İptal oranı dikkat gerektiriyor', insightCancellationExplanation: 'Randevuların önemli bir bölümü iptal nedeniyle gerçekleşmedi.',
    insightNoShowTitle: 'No-show kapasiteyi etkiliyor', insightNoShowExplanation: 'No-show randevular tamamlanmadan rezervasyon kapasitesini tüketiyor.',
    insightRetentionTitle: 'Müşteri tutma fırsatı', insightRetentionExplanation: 'Riskli müşteriler ölçülü bir yeniden etkileşimle hedeflenebilir.',
    insightReturningTitle: 'Sağlıklı geri dönen müşteri tabanı', insightReturningExplanation: 'Müşterilerin anlamlı bir bölümü birden fazla ziyareti tamamladı.',
    insightOutOfStockTitle: 'Stokta olmayan ürünler var', insightOutOfStockExplanation: 'Bazı aktif ürünlerde kullanılabilir stok yok.',
    insightLowStockTitle: 'Düşük stok incelenmeli', insightLowStockExplanation: 'Aktif ürünler minimum seviyeye ulaştı veya altına düştü.',
    insightMarketingTitle: 'Dönüşüm iyileştirme fırsatı', insightMarketingExplanation: 'Mesajlar teslim ediliyor, ancak kayıtlı dönüşümler sınırlı.',
    insightServiceTitle: 'Önde gelen hizmet belirlendi', insightServiceExplanation: 'Bir hizmet kayıtlı rezervasyon talebinde önde.',
    evidenceRevenue: 'Mevcut gelir: {current}; önceki dönem: {previous}.',
    evidenceProfit: 'Faaliyet kârı: {profit}; ödenmiş giderler: {expenses}.',
    evidenceCancellation: '{total} randevudan {cancelled} iptal (%{rate}).',
    evidenceNoShow: '{total} randevudan {noShows} no-show (%{rate}).',
    evidenceRetention: '{atRisk} riskli ve {dormant} pasif müşteri.',
    evidenceReturning: '{returning} geri dönen müşteri (%{rate}).',
    evidenceInventory: '{out} stokta yok ve {low} minimumda/altında.',
    evidenceMarketing: '{delivered} teslim edilen mesaj ve {converted} kayıtlı dönüşüm.',
    evidenceService: '{name}: {bookings} rezervasyon ve {revenue} gelir.',
    actionFinanceTitle: 'Finansı aç', actionFinanceReason: 'Gelir, kâr, gider ve günlük performansı doğrulayın.',
    actionCalendarTitle: 'Takvimi aç', actionCalendarReason: 'Randevu talebi, iptal ve ekip kapasitesini inceleyin.',
    actionCustomersTitle: 'Müşterileri aç', actionCustomersReason: 'Tutma, riskli ve pasif segmentleri inceleyin.',
    actionStaffTitle: 'Ekibi aç', actionStaffReason: 'İş yükü ve ekip performansını karşılaştırın.',
    actionServicesTitle: 'Hizmetleri aç', actionServicesReason: 'Talep, süre ve hizmet değerini inceleyin.',
    actionInventoryTitle: 'Ürünleri aç', actionInventoryReason: 'Düşük stok, stokta olmayanlar ve stok değerini inceleyin.',
    actionMarketingTitle: 'Marketingi aç', actionMarketingReason: 'Kampanya, teslimat ve dönüşümleri inceleyin.',
    actionReportsTitle: 'Raporları aç', actionReportsReason: 'Genel eğilimi raporlarda doğrulayın.',
    followFinance: 'Sırada hangi gelir veya kâr metriğini inceleyelim?',
    followCustomers: 'Geri dönen, riskli veya pasif müşterilere mi odaklanayım?',
    followScheduling: 'İptal, no-show veya yaklaşan kapasiteye mi odaklanayım?',
    followStaff: 'İş yükü veya tamamlanma oranlarını mı karşılaştırayım?',
    followServices: 'Talep, gelir veya ortalama değeri mi karşılaştırayım?',
    followInventory: 'Stokta olmayanlara mı, toplam stok değerine mi odaklanayım?',
    followMarketing: 'Teslimat, dönüşüm veya atfedilen gelire mi odaklanayım?',
    followHealth: 'Hangi alanı daha ayrıntılı analiz edeyim?',
  },
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentication is required' }, 401);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const businessId = String(body.businessId || '').trim();
  const agent = String(body.agent || 'business_coach').trim();
  const message = String(body.message || '').trim();
  const language = normalizeLanguage(body.language);
  const periodDays = clamp(Number(body.periodDays || 30), 7, 90);

  if (!businessId) return json({ error: 'businessId is required' }, 400);
  if (!ALLOWED_AGENTS.has(agent)) return json({ error: 'Unsupported AI agent' }, 400);
  if (!message || message.length < 2) return json({ error: 'A message is required' }, 400);
  if (message.length > 4000) return json({ error: 'The message cannot exceed 4000 characters' }, 400);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Invalid user session' }, 401);
  const user = authData.user;

  const { data: membership, error: membershipError } = await userClient
    .from('business_members')
    .select('role, businesses(id, name, industry_key, currency, timezone)')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership) return json({ error: 'You do not have access to this business' }, 403);

  const membershipRole = normalizeRole(String((membership as any).role || 'Employee'));
  const requiredCapability = REQUIRED_CAPABILITY_BY_AGENT[agent];
  const capabilities = CAPABILITIES_BY_ROLE[membershipRole] || CAPABILITIES_BY_ROLE.Employee;
  if (requiredCapability && !capabilities.includes(requiredCapability)) {
    return json({ error: 'You do not have permission to use this AI specialist' }, 403);
  }

  const { data: settings, error: settingsError } = await userClient
    .from('ai_settings')
    .select('enabled, default_language, response_style, retain_history, proactive_insights, daily_request_limit')
    .eq('business_id', businessId)
    .maybeSingle();

  if (settingsError) return json({ error: settingsError.message }, 500);
  if (settings && settings.enabled === false) return json({ error: 'Velliqo AI is disabled for this business' }, 403);

  const dailyLimit = clamp(Number(settings?.daily_request_limit || 50), 1, 500);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: requestsToday } = await serviceClient
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString());

  if ((requestsToday || 0) >= dailyLimit) {
    return json({ error: 'The daily Velliqo AI request limit has been reached' }, 429);
  }

  let conversationId = String(body.conversationId || '').trim() || null;
  if (!conversationId && settings?.retain_history === false) {
    await serviceClient
      .from('ai_conversations')
      .delete()
      .eq('business_id', businessId)
      .eq('user_id', user.id);
  }

  if (conversationId) {
    const { data: conversation } = await serviceClient
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!conversation) return json({ error: 'Conversation not found' }, 404);
  } else {
    const { data: conversation, error: conversationError } = await serviceClient
      .from('ai_conversations')
      .insert({
        business_id: businessId,
        user_id: user.id,
        agent_key: agent,
        title: message.slice(0, 90),
        language,
      })
      .select('id')
      .single();
    if (conversationError) return json({ error: conversationError.message }, 500);
    conversationId = conversation.id;
  }

  const { error: userMessageError } = await serviceClient.from('ai_messages').insert({
    conversation_id: conversationId,
    business_id: businessId,
    user_id: user.id,
    role: 'user',
    content: message,
    metadata: { agent, page: body.page || null, periodDays, engine: ENGINE_NAME },
  });
  if (userMessageError) return json({ error: userMessageError.message }, 500);

  const { data: snapshot, error: snapshotError } = await userClient.rpc('get_ai_business_snapshot', {
    p_business_id: businessId,
    p_days: periodDays,
  });
  if (snapshotError) return json({ error: snapshotError.message }, 500);

  const { data: recentMessages } = await serviceClient
    .from('ai_messages')
    .select('role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  const responseLanguage = normalizeLanguage(settings?.default_language || language);
  const responseStyle = String(settings?.response_style || 'balanced');
  const startedAt = Date.now();

  try {
    const resolvedText = resolveContextMessage(message, recentMessages || []);
    const topic = classifyTopic(resolvedText, agent);
    const structured = generateStructuredResponse({
      language: responseLanguage,
      topic,
      message,
      responseStyle,
      snapshot,
      asksWhy: asksWhyQuestion(message),
    });
    if (settings?.proactive_insights === false) structured.insights = [];
    const latencyMs = Date.now() - startedAt;

    const { data: assistantMessage, error: assistantMessageError } = await serviceClient
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        business_id: businessId,
        user_id: null,
        role: 'assistant',
        content: structured.answer,
        model: ENGINE_NAME,
        input_tokens: 0,
        output_tokens: 0,
        metadata: {
          agent,
          topic,
          response: structured,
          provider: 'velliqo_free',
          latency_ms: latencyMs,
          snapshot_generated_at: snapshot?.generatedAt || null,
          read_only: true,
          external_ai: false,
          estimated_cost: 0,
        },
      })
      .select('id, created_at')
      .single();

    if (assistantMessageError) throw assistantMessageError;

    if (structured.insights.length > 0) {
      const insightRows = structured.insights.slice(0, 6).map((insight) => ({
        business_id: businessId,
        user_id: user.id,
        conversation_id: conversationId,
        agent_key: agent,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        summary: insight.explanation,
        evidence: { items: insight.evidence },
        recommendation: { text: insight.recommendation },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));
      await serviceClient.from('ai_insights').insert(insightRows);
    }

    await serviceClient.from('ai_usage_events').insert({
      business_id: businessId,
      user_id: user.id,
      agent_key: agent,
      provider: 'velliqo_free',
      model: ENGINE_NAME,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost: 0,
      success: true,
    });

    await serviceClient
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString(), agent_key: agent, language: responseLanguage })
      .eq('id', conversationId);

    return json({
      conversationId,
      messageId: assistantMessage.id,
      createdAt: assistantMessage.created_at,
      response: structured,
      model: ENGINE_NAME,
      provider: 'velliqo_free',
      usage: { inputTokens: 0, outputTokens: 0 },
      estimatedCost: 0,
      readOnly: true,
    });
  } catch (error) {
    console.error('Velliqo free intelligence manager failed', error);
    await serviceClient.from('ai_usage_events').insert({
      business_id: businessId,
      user_id: user.id,
      agent_key: agent,
      provider: 'velliqo_free',
      model: ENGINE_NAME,
      estimated_cost: 0,
      success: false,
    });
    return json({ error: errorMessage(error) }, 500);
  }
});

function generateStructuredResponse(context: AnalysisContext): StructuredAIResponse {
  const { snapshot, language, topic, responseStyle, asksWhy } = context;
  const days = number(snapshot?.period?.days, 30);
  const score = calculateHealthScore(snapshot);
  const confidence = calculateConfidence(snapshot);
  const allInsights = buildInsights(snapshot, language);
  const insights = selectInsights(allInsights, topic, responseStyle);
  const summary = healthSummary(score, language);
  const sections = buildTopicSections(topic, snapshot, language);
  const recommendation = recommendationForTopic(topic, language);

  const detailLimit = responseStyle === 'concise' ? 1 : responseStyle === 'detailed' ? 8 : 4;
  const answerParts: string[] = [
    tr(language, 'healthScore', { score, days }),
    summary,
    ...sections.slice(0, detailLimit),
  ];

  if (asksWhy) answerParts.push(tr(language, 'causalLimit'));
  answerParts.push(`${tr(language, 'recommendationPrefix')} ${recommendation}`);
  const answer = answerParts.join('\n\n');

  return {
    answer,
    executive_summary: `${tr(language, 'healthScore', { score, days })} ${summary}`,
    business_health_score: score,
    confidence,
    insights,
    suggested_actions: actionsForTopic(topic, language, insights),
    follow_up_questions: followUpsForTopic(topic, language),
  };
}

function buildTopicSections(topic: Topic, snapshot: any, language: AILanguage): string[] {
  const days = number(snapshot?.period?.days, 30);
  const currency = String(snapshot?.business?.currency || 'EUR');
  const finance = snapshot?.finance?.summary || {};
  const previous = snapshot?.previousFinance?.summary || {};
  const appointments = snapshot?.appointments || {};
  const customers = snapshot?.customers || {};
  const inventory = snapshot?.inventory || {};
  const marketing = snapshot?.marketing || {};
  const staff = array(snapshot?.staff);
  const services = array(snapshot?.services);

  if (topic === 'support') return [tr(language, 'supportLine')];

  if (topic === 'finance') {
    const currentRevenue = number(finance.collectedRevenue);
    const previousRevenue = number(previous.collectedRevenue);
    const change = percentChange(currentRevenue, previousRevenue);
    const trend = previousRevenue <= 0
      ? tr(language, 'revenueNoComparison')
      : change > 3
        ? tr(language, 'revenueUp', { change: formatPercentMagnitude(change, language) })
        : change < -3
          ? tr(language, 'revenueDown', { change: formatPercentMagnitude(change, language) })
          : tr(language, 'revenueFlat', { change: formatSignedPercent(change, language) });

    return [
      tr(language, 'revenueLine', {
        revenue: money(currentRevenue, currency, language),
        transactions: integer(finance.transactionCount),
        days,
      }),
      trend,
      tr(language, 'profitLine', {
        profit: money(finance.operatingProfit, currency, language),
        expenses: money(finance.paidExpenses, currency, language),
        margin: formatNumber(finance.grossMargin, language, 1),
      }),
      tr(language, 'averageTicket', { ticket: money(finance.averageTicket, currency, language) }),
    ];
  }

  if (topic === 'scheduling') {
    return [
      tr(language, 'schedulingLine', {
        total: integer(appointments.total),
        completed: integer(appointments.completed),
        cancelled: integer(appointments.cancelled),
        noShows: integer(appointments.noShows),
      }),
      tr(language, 'schedulingRates', {
        completion: formatNumber(appointments.completionRate, language, 1),
        cancellation: formatNumber(appointments.cancellationRate, language, 1),
        noShow: formatNumber(appointments.noShowRate, language, 1),
      }),
      tr(language, 'upcomingLine', { count: integer(appointments.nextSevenDays) }),
    ];
  }

  if (topic === 'customers') {
    return [
      tr(language, 'customersLine', {
        total: integer(customers.total),
        newCount: integer(customers.newInPeriod),
      }),
      tr(language, 'retentionLine', {
        returning: integer(customers.returning),
        rate: formatNumber(customers.returningRate, language, 1),
        atRisk: integer(customers.atRisk),
      }),
    ];
  }

  if (topic === 'staff') {
    const leader = staff[0];
    return leader
      ? [tr(language, 'staffLine', {
        name: String(leader.name || '-'),
        appointments: integer(leader.appointments),
        value: money(leader.appointmentValue, currency, language),
      })]
      : [tr(language, 'noStaffData')];
  }

  if (topic === 'services') {
    const leader = services[0];
    return leader
      ? [tr(language, 'servicesLine', {
        name: String(leader.name || '-'),
        bookings: integer(leader.bookings),
        revenue: money(leader.revenue, currency, language),
      })]
      : [tr(language, 'noServiceData')];
  }

  if (topic === 'inventory') {
    return [
      tr(language, 'inventoryLine', {
        active: integer(inventory.activeProducts),
        low: integer(inventory.lowStock),
        out: integer(inventory.outOfStock),
      }),
      tr(language, 'inventoryValue', {
        costValue: money(inventory.stockCostValue, currency, language),
        retailValue: money(inventory.stockRetailValue, currency, language),
      }),
    ];
  }

  if (topic === 'marketing') {
    const sent = number(marketing.sent);
    const delivered = number(marketing.delivered);
    const converted = number(marketing.converted);
    return [
      tr(language, 'marketingLine', {
        campaigns: integer(marketing.campaignsInPeriod),
        sent: integer(sent),
        delivered: integer(delivered),
        converted: integer(converted),
      }),
      tr(language, 'marketingRates', {
        deliveryRate: formatNumber(sent > 0 ? (delivered / sent) * 100 : 0, language, 1),
        conversionRate: formatNumber(delivered > 0 ? (converted / delivered) * 100 : 0, language, 1),
        revenue: money(marketing.attributedRevenue, currency, language),
      }),
    ];
  }

  const currentRevenue = number(finance.collectedRevenue);
  const transactionCount = number(finance.transactionCount);
  if (number(appointments.total) === 0 && number(customers.total) === 0 && transactionCount === 0) {
    return [tr(language, 'noData')];
  }

  const sections: string[] = [
    tr(language, 'revenueLine', {
      revenue: money(currentRevenue, currency, language),
      transactions: integer(transactionCount),
      days,
    }),
    tr(language, 'schedulingRates', {
      completion: formatNumber(appointments.completionRate, language, 1),
      cancellation: formatNumber(appointments.cancellationRate, language, 1),
      noShow: formatNumber(appointments.noShowRate, language, 1),
    }),
    tr(language, 'retentionLine', {
      returning: integer(customers.returning),
      rate: formatNumber(customers.returningRate, language, 1),
      atRisk: integer(customers.atRisk),
    }),
  ];

  if (number(inventory.lowStock) > 0) {
    sections.push(tr(language, 'inventoryLine', {
      active: integer(inventory.activeProducts),
      low: integer(inventory.lowStock),
      out: integer(inventory.outOfStock),
    }));
  }
  return sections;
}

function buildInsights(snapshot: any, language: AILanguage): Insight[] {
  const insights: Insight[] = [];
  const currency = String(snapshot?.business?.currency || 'EUR');
  const finance = snapshot?.finance?.summary || {};
  const previous = snapshot?.previousFinance?.summary || {};
  const appointments = snapshot?.appointments || {};
  const customers = snapshot?.customers || {};
  const inventory = snapshot?.inventory || {};
  const marketing = snapshot?.marketing || {};
  const services = array(snapshot?.services);

  const currentRevenue = number(finance.collectedRevenue);
  const previousRevenue = number(previous.collectedRevenue);
  const revenueChange = percentChange(currentRevenue, previousRevenue);

  if (previousRevenue > 0 && revenueChange >= 8) {
    insights.push({
      category: 'finance',
      severity: 'opportunity',
      title: tr(language, 'insightRevenueUpTitle'),
      explanation: tr(language, 'insightRevenueUpExplanation'),
      evidence: [tr(language, 'evidenceRevenue', {
        current: money(currentRevenue, currency, language),
        previous: money(previousRevenue, currency, language),
      })],
      recommendation: tr(language, 'financeRecommendation'),
    });
  } else if (previousRevenue > 0 && revenueChange <= -8) {
    insights.push({
      category: 'finance',
      severity: revenueChange <= -20 ? 'critical' : 'warning',
      title: tr(language, 'insightRevenueDownTitle'),
      explanation: tr(language, 'insightRevenueDownExplanation'),
      evidence: [tr(language, 'evidenceRevenue', {
        current: money(currentRevenue, currency, language),
        previous: money(previousRevenue, currency, language),
      })],
      recommendation: tr(language, 'financeRecommendation'),
    });
  }

  if (number(finance.operatingProfit) < 0) {
    insights.push({
      category: 'finance',
      severity: 'critical',
      title: tr(language, 'insightProfitTitle'),
      explanation: tr(language, 'insightProfitExplanation'),
      evidence: [tr(language, 'evidenceProfit', {
        profit: money(finance.operatingProfit, currency, language),
        expenses: money(finance.paidExpenses, currency, language),
      })],
      recommendation: tr(language, 'financeRecommendation'),
    });
  }

  if (number(appointments.cancellationRate) >= 12) {
    insights.push({
      category: 'scheduling',
      severity: number(appointments.cancellationRate) >= 20 ? 'critical' : 'warning',
      title: tr(language, 'insightCancellationTitle'),
      explanation: tr(language, 'insightCancellationExplanation'),
      evidence: [tr(language, 'evidenceCancellation', {
        cancelled: integer(appointments.cancelled),
        total: integer(appointments.total),
        rate: formatNumber(appointments.cancellationRate, language, 1),
      })],
      recommendation: tr(language, 'schedulingRecommendation'),
    });
  }

  if (number(appointments.noShowRate) >= 5) {
    insights.push({
      category: 'scheduling',
      severity: number(appointments.noShowRate) >= 10 ? 'warning' : 'opportunity',
      title: tr(language, 'insightNoShowTitle'),
      explanation: tr(language, 'insightNoShowExplanation'),
      evidence: [tr(language, 'evidenceNoShow', {
        noShows: integer(appointments.noShows),
        total: integer(appointments.total),
        rate: formatNumber(appointments.noShowRate, language, 1),
      })],
      recommendation: tr(language, 'schedulingRecommendation'),
    });
  }

  if (number(customers.atRisk) > 0 || number(customers.dormant) > 0) {
    insights.push({
      category: 'customers',
      severity: number(customers.atRisk) >= 10 ? 'warning' : 'opportunity',
      title: tr(language, 'insightRetentionTitle'),
      explanation: tr(language, 'insightRetentionExplanation'),
      evidence: [tr(language, 'evidenceRetention', {
        atRisk: integer(customers.atRisk),
        dormant: integer(customers.dormant),
      })],
      recommendation: tr(language, 'customersRecommendation'),
    });
  } else if (number(customers.returningRate) >= 40 && number(customers.total) > 0) {
    insights.push({
      category: 'customers',
      severity: 'opportunity',
      title: tr(language, 'insightReturningTitle'),
      explanation: tr(language, 'insightReturningExplanation'),
      evidence: [tr(language, 'evidenceReturning', {
        returning: integer(customers.returning),
        rate: formatNumber(customers.returningRate, language, 1),
      })],
      recommendation: tr(language, 'customersRecommendation'),
    });
  }

  if (number(inventory.outOfStock) > 0) {
    insights.push({
      category: 'inventory',
      severity: 'critical',
      title: tr(language, 'insightOutOfStockTitle'),
      explanation: tr(language, 'insightOutOfStockExplanation'),
      evidence: [tr(language, 'evidenceInventory', {
        out: integer(inventory.outOfStock),
        low: integer(inventory.lowStock),
      })],
      recommendation: tr(language, 'inventoryRecommendation'),
    });
  } else if (number(inventory.lowStock) > 0) {
    insights.push({
      category: 'inventory',
      severity: 'warning',
      title: tr(language, 'insightLowStockTitle'),
      explanation: tr(language, 'insightLowStockExplanation'),
      evidence: [tr(language, 'evidenceInventory', {
        out: integer(inventory.outOfStock),
        low: integer(inventory.lowStock),
      })],
      recommendation: tr(language, 'inventoryRecommendation'),
    });
  }

  if (number(marketing.delivered) >= 10 && number(marketing.converted) === 0) {
    insights.push({
      category: 'marketing',
      severity: 'opportunity',
      title: tr(language, 'insightMarketingTitle'),
      explanation: tr(language, 'insightMarketingExplanation'),
      evidence: [tr(language, 'evidenceMarketing', {
        delivered: integer(marketing.delivered),
        converted: integer(marketing.converted),
      })],
      recommendation: tr(language, 'marketingRecommendation'),
    });
  }

  const leadingService = services[0];
  if (leadingService && number(leadingService.bookings) > 0) {
    insights.push({
      category: 'services',
      severity: 'opportunity',
      title: tr(language, 'insightServiceTitle'),
      explanation: tr(language, 'insightServiceExplanation'),
      evidence: [tr(language, 'evidenceService', {
        name: String(leadingService.name || '-'),
        bookings: integer(leadingService.bookings),
        revenue: money(leadingService.revenue, currency, language),
      })],
      recommendation: tr(language, 'servicesRecommendation'),
    });
  }

  return insights.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function selectInsights(insights: Insight[], topic: Topic, responseStyle: string) {
  const limit = responseStyle === 'concise' ? 2 : responseStyle === 'detailed' ? 6 : 4;
  if (topic === 'business_health' || topic === 'support') return insights.slice(0, limit);
  const topicMatches = insights.filter((item) => item.category === topic);
  const other = insights.filter((item) => item.category !== topic);
  return [...topicMatches, ...other].slice(0, limit);
}

function actionsForTopic(topic: Topic, language: AILanguage, insights: Insight[]): SuggestedAction[] {
  const topics = new Set<Topic>([topic]);
  for (const insight of insights) topics.add(insight.category);

  const actions: SuggestedAction[] = [];
  const add = (action: SuggestedAction) => {
    if (!actions.some((item) => item.type === action.type)) actions.push(action);
  };

  if (topics.has('finance') || topics.has('business_health')) add(action('finance', language));
  if (topics.has('scheduling') || topics.has('business_health')) add(action('scheduling', language));
  if (topics.has('customers')) add(action('customers', language));
  if (topics.has('staff')) add(action('staff', language));
  if (topics.has('services')) add(action('services', language));
  if (topics.has('inventory')) add(action('inventory', language));
  if (topics.has('marketing')) add(action('marketing', language));
  if (topic === 'business_health') add(action('reports', language));
  return actions.slice(0, 4);
}

function action(topic: Topic | 'reports', language: AILanguage): SuggestedAction {
  const map: Record<string, SuggestedAction> = {
    finance: { type: 'open_finance', title: tr(language, 'actionFinanceTitle'), rationale: tr(language, 'actionFinanceReason'), destinationPath: '/dashboard/finance' },
    scheduling: { type: 'open_calendar', title: tr(language, 'actionCalendarTitle'), rationale: tr(language, 'actionCalendarReason'), destinationPath: '/dashboard/calendar' },
    customers: { type: 'open_customers', title: tr(language, 'actionCustomersTitle'), rationale: tr(language, 'actionCustomersReason'), destinationPath: '/dashboard/customers' },
    staff: { type: 'open_staff', title: tr(language, 'actionStaffTitle'), rationale: tr(language, 'actionStaffReason'), destinationPath: '/dashboard/staff' },
    services: { type: 'open_services', title: tr(language, 'actionServicesTitle'), rationale: tr(language, 'actionServicesReason'), destinationPath: '/dashboard/services' },
    inventory: { type: 'open_inventory', title: tr(language, 'actionInventoryTitle'), rationale: tr(language, 'actionInventoryReason'), destinationPath: '/dashboard/products' },
    marketing: { type: 'open_marketing', title: tr(language, 'actionMarketingTitle'), rationale: tr(language, 'actionMarketingReason'), destinationPath: '/dashboard/marketing' },
    reports: { type: 'open_reports', title: tr(language, 'actionReportsTitle'), rationale: tr(language, 'actionReportsReason'), destinationPath: '/dashboard/reports' },
    business_health: { type: 'open_reports', title: tr(language, 'actionReportsTitle'), rationale: tr(language, 'actionReportsReason'), destinationPath: '/dashboard/reports' },
    support: { type: 'open_reports', title: tr(language, 'actionReportsTitle'), rationale: tr(language, 'actionReportsReason'), destinationPath: '/dashboard/reports' },
  };
  return map[topic];
}

function followUpsForTopic(topic: Topic, language: AILanguage) {
  const keyMap: Record<Topic, string> = {
    finance: 'followFinance',
    customers: 'followCustomers',
    scheduling: 'followScheduling',
    staff: 'followStaff',
    services: 'followServices',
    inventory: 'followInventory',
    marketing: 'followMarketing',
    business_health: 'followHealth',
    support: 'followHealth',
  };
  const first = tr(language, keyMap[topic]);
  const second = topic === 'business_health' || topic === 'support'
    ? tr(language, 'followFinance')
    : tr(language, 'followHealth');
  return [first, second];
}

function recommendationForTopic(topic: Topic, language: AILanguage) {
  const keyMap: Record<Topic, string> = {
    finance: 'financeRecommendation',
    scheduling: 'schedulingRecommendation',
    customers: 'customersRecommendation',
    staff: 'staffRecommendation',
    services: 'servicesRecommendation',
    inventory: 'inventoryRecommendation',
    marketing: 'marketingRecommendation',
    business_health: 'healthRecommendation',
    support: 'healthRecommendation',
  };
  return tr(language, keyMap[topic]);
}

function calculateHealthScore(snapshot: any) {
  const finance = snapshot?.finance?.summary || {};
  const previous = snapshot?.previousFinance?.summary || {};
  const appointments = snapshot?.appointments || {};
  const customers = snapshot?.customers || {};
  const inventory = snapshot?.inventory || {};

  const totalActivity = number(appointments.total) + number(finance.transactionCount) + number(customers.total);
  if (totalActivity === 0) return 50;

  let score = 72;
  const revenueChange = percentChange(number(finance.collectedRevenue), number(previous.collectedRevenue));
  if (number(previous.collectedRevenue) > 0) score += clampDecimal(revenueChange / 4, -15, 10);
  if (number(finance.operatingProfit) < 0) score -= 15;
  else if (number(finance.operatingProfit) > 0) score += 4;

  const cancellationRate = number(appointments.cancellationRate);
  const noShowRate = number(appointments.noShowRate);
  score -= cancellationRate >= 20 ? 14 : cancellationRate >= 12 ? 8 : cancellationRate >= 6 ? 3 : 0;
  score -= noShowRate >= 10 ? 10 : noShowRate >= 5 ? 5 : 0;

  const returningRate = number(customers.returningRate);
  if (returningRate >= 50) score += 8;
  else if (returningRate >= 30) score += 4;
  else if (number(customers.total) >= 5 && returningRate < 15) score -= 8;

  score -= Math.min(number(inventory.outOfStock) * 3, 12);
  score -= Math.min(Math.max(number(inventory.lowStock) - number(inventory.outOfStock), 0), 6);
  return clamp(Math.round(score), 0, 100);
}

function calculateConfidence(snapshot: any): 'low' | 'medium' | 'high' {
  const appointments = number(snapshot?.appointments?.total);
  const transactions = number(snapshot?.finance?.summary?.transactionCount);
  const customers = number(snapshot?.customers?.total);
  const signals = appointments + transactions + customers;
  if (signals >= 80 && (appointments >= 15 || transactions >= 15)) return 'high';
  if (signals >= 15) return 'medium';
  return 'low';
}

function healthSummary(score: number, language: AILanguage) {
  if (score >= 82) return tr(language, 'healthExcellent');
  if (score >= 65) return tr(language, 'healthGood');
  if (score >= 45) return tr(language, 'healthWatch');
  return tr(language, 'healthCritical');
}

function classifyTopic(message: string, agent: string): Topic {
  const normalized = normalizeText(message);
  const keywordGroups: Array<[Topic, string[]]> = [
    ['finance', ['revenue', 'income', 'profit', 'sales', 'expense', 'margin', 'finance', 'turnover', 'εσοδ', 'κερδ', 'πωλη', 'εξοδ', 'οικονομ', 'τζιρ', 'umsatz', 'gewinn', 'ausgabe', 'finanz', 'ingreso', 'beneficio', 'venta', 'gasto', 'finanzas', 'gelir', 'kar', 'satis', 'gider', 'finans']],
    ['customers', ['customer', 'client', 'retention', 'returning', 'churn', 'loyal', 'at risk', 'dormant', 'πελατ', 'διατηρ', 'επιστροφ', 'αδραν', 'κινδυν', 'kunde', 'bindung', 'cliente', 'retencion', 'musteri', 'sadakat']],
    ['scheduling', ['schedule', 'appointment', 'booking', 'calendar', 'cancel', 'no show', 'capacity', 'slot', 'ραντεβ', 'προγραμμα', 'ημερολογ', 'ακυρ', 'χωρητικ', 'termin', 'kalender', 'storno', 'cita', 'agenda', 'cancelacion', 'randevu', 'takvim', 'iptal']],
    ['staff', ['staff', 'employee', 'team', 'barber', 'workload', 'personnel', 'προσωπ', 'εργαζ', 'ομαδ', 'φορτο', 'mitarbeiter', 'team', 'equipo', 'empleado', 'personel', 'calisan', 'ekip']],
    ['services', ['service', 'treatment', 'most booked', 'best service', 'υπηρεσ', 'δημοφιλ', 'κρατησ', 'leistung', 'servicio', 'hizmet']],
    ['inventory', ['inventory', 'stock', 'product', 'out of stock', 'low stock', 'αποθεμ', 'προιον', 'εξαντλ', 'lager', 'bestand', 'produkt', 'inventario', 'producto', 'stok', 'urun']],
    ['marketing', ['marketing', 'campaign', 'email', 'conversion', 'delivery', 'audience', 'καμπαν', 'μαρκετινγκ', 'μετατροπ', 'παραδοσ', 'kampagne', 'zustellung', 'campana', 'conversion', 'kampanya', 'donusum']],
    ['support', ['what can you do', 'help me', 'capabilities', 'how can you help', 'τι μπορει', 'βοηθεια', 'δυνατοτητ', 'was kannst', 'hilfe', 'que puedes', 'ayuda', 'ne yapabilirsin', 'yardim']],
    ['business_health', ['overview', 'briefing', 'business health', 'summary', 'performance', 'overall', 'today', 'εικονα', 'ενημερωση', 'υγεια', 'αποδοση', 'συνολικ', 'uberblick', 'gesundheit', 'resumen', 'salud', 'ozet', 'saglik']],
  ];

  let best: { topic: Topic; score: number } | null = null;
  for (const [topic, keywords] of keywordGroups) {
    const score = keywords.reduce((sum, keyword) => sum + (normalized.includes(normalizeText(keyword)) ? keyword.length : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  if (best) return best.topic;

  const fallback: Record<string, Topic> = {
    business_coach: 'business_health',
    financial_analyst: 'finance',
    marketing_expert: 'marketing',
    scheduling_assistant: 'scheduling',
    customer_success: 'customers',
    inventory_advisor: 'inventory',
    support_assistant: 'support',
  };
  return fallback[agent] || 'business_health';
}

function resolveContextMessage(message: string, recentMessages: any[]) {
  const normalized = normalizeText(message);
  const followUpWords = ['why', 'more', 'continue', 'explain', 'detail', 'γιατι', 'περισσοτερ', 'συνεχ', 'εξηγη', 'warum', 'mehr', 'weiter', 'por que', 'mas', 'devam', 'neden'];
  const isShortFollowUp = normalized.length < 80 && followUpWords.some((word) => normalized.includes(normalizeText(word)));
  if (!isShortFollowUp) return message;

  const previousUser = [...recentMessages]
    .find((item) => item.role === 'user' && String(item.content || '').trim() !== message.trim());
  return previousUser ? `${String(previousUser.content)} ${message}` : message;
}

function asksWhyQuestion(message: string) {
  const normalized = normalizeText(message);
  return ['why', 'cause', 'reason', 'γιατι', 'αιτια', 'λογο', 'warum', 'grund', 'por que', 'causa', 'neden', 'sebep']
    .some((word) => normalized.includes(normalizeText(word)));
}

function tr(language: AILanguage, key: string, variables: Record<string, unknown> = {}) {
  const template = COPY[language]?.[key] || COPY.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, token) => String(variables[token] ?? ''));
}

function money(value: unknown, currency: string, language: AILanguage) {
  try {
    return new Intl.NumberFormat(locale(language), { style: 'currency', currency, maximumFractionDigits: 2 }).format(number(value));
  } catch {
    return `${number(value).toFixed(2)} ${currency}`;
  }
}

function formatNumber(value: unknown, language: AILanguage, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits }).format(number(value));
}

function formatSignedPercent(value: number, language: AILanguage) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value);
}

function formatPercentMagnitude(value: number, language: AILanguage) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 1 }).format(Math.abs(value));
}

function locale(language: AILanguage) {
  return ({ en: 'en-GB', el: 'el-GR', de: 'de-DE', es: 'es-ES', tr: 'tr-TR' } as const)[language];
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim();
}

function normalizeLanguage(value: unknown): AILanguage {
  const language = String(value || 'en').toLowerCase().split('-')[0];
  return (['en', 'el', 'de', 'es', 'tr'].includes(language) ? language : 'en') as AILanguage;
}

function normalizeRole(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('owner')) return 'Owner';
  if (normalized.includes('manager')) return 'Manager';
  return 'Employee';
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value: unknown) {
  return Math.round(number(value));
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function clampDecimal(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, min), max);
}

function severityRank(severity: InsightSeverity) {
  return { info: 1, opportunity: 2, warning: 3, critical: 4 }[severity];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}
