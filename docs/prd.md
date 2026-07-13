# Requirements Document

## 1. Application Overview

**Application Name**: Salon & Barber SaaS Platform

**Description**: A professional multi-tenant SaaS platform enabling barbers, hairdressers and salon owners to manage their businesses independently. Each business operates in an isolated workspace with a dedicated public standalone app accessible via unique QR code and link. Customers scan the QR code to access the business's app, authenticate or continue as guest, view business information, book appointments, browse services and products, and receive confirmation and reminder notifications.

## 2. Users and Usage Scenarios

### 2.1 Target Users

- **Platform Admin**: Manages the entire SaaS platform, monitors all businesses, subscriptions and system health
- **Business Owner**: Creates and manages their salon/barbershop, configures services, staff, working hours, uploads photos, customizes public app appearance and generates QR code
- **Manager**: Assists owner with business operations within assigned permissions
- **Employee/Barber/Hairdresser**: Views assigned appointments, manages personal schedule and service delivery
- **Registered Customer**: Creates account at specific business, books appointments, manages profile and views appointment history
- **Guest Customer**: Books appointments without creating account using business's public app

### 2.2 Core Usage Scenarios

- Business owners onboard their salon, configure services and staff, upload photos, customize public app and generate QR code
- Owners share QR code and link with customers via print materials, social media or website
- Customers scan QR code or visit link to access business's standalone public app
- Customers choose to sign in, create account or continue as guest for this specific business
- Customers view business dashboard page with photos, information and map
- Customers book appointments, browse services and products, and receive confirmation and reminder notifications
- Employees view their daily schedule, mark appointment statuses and track service completion
- Owners monitor business performance through reports, manage inventory and track revenue versus expenses
- Platform admins oversee all tenant businesses, subscription statuses and system operations

## 3. Page Structure and Functionality

### 3.1 Page Hierarchy

```
├── Public Business App (/app/{business-slug})
│   ├── Authentication Gate (Landing Page)
│   ├── Sign Up (for this business)
│   ├── Sign In (for this business)
│   ├── Business Dashboard Page (after authentication or as guest)
│   ├── New Appointment (Booking Page)
│   └── Guest Booking Management (secure token link)
│
├── Authentication
│   ├── Sign Up
│   ├── Sign In
│   ├── Password Reset
│   └── Email Verification
│
├── Owner Onboarding Flow
│   ├── Step 1: Create Account
│   ├── Step 2: Business Information
│   ├── Step 3: Services Setup
│   ├── Step 4: Staff Setup
│   ├── Step 5: Working Hours
│   ├── Step 6: Subscription Selection
│   └── Step 7: App Link & QR Code
│
├── Business Owner Dashboard
│   ├── Dashboard (Overview)
│   ├── Calendar
│   ├── Appointments
│   ├── Customers
│   ├── Staff
│   ├── Services
│   ├── Products
│   ├── Reports
│   ├── Business Settings
│   │   ├── Business Profile
│   │   ├── Public App Customization
│   │   ├── Working Hours
│   │   ├── Booking Policies
│   │   ├── Notification Settings
│   │   └── QR Code & App Link
│   └── Subscription & Billing
│
├── Employee Dashboard
│   ├── My Schedule
│   ├── My Appointments
│   ├── Time Off Requests
│   └── Profile Settings
│
├── Customer Portal
│   ├── Upcoming Appointments
│   ├── Appointment History
│   ├── Profile Settings
│   └── Reminder Preferences
│
└── Platform Admin Dashboard
    ├── Admin Overview
    ├── Business Management
    ├── Subscription Management
    ├── Revenue Analytics
    ├── Support Requests
    ├── System Health
    └── Audit Logs
```

### 3.2 Owner Onboarding Flow

**Step 1: Create Account**
- User enters email and password
- System sends verification email
- User verifies email and proceeds

**Step 2: Business Information**
- Enter business name
- Upload logo (if not uploaded, system displays default scissors icon)
- Enter phone number
- Enter email address
- Enter full address
- Select country
- Select currency
- Select timezone
- Upload business photos (optional, can be added later)
- Enter business description
- **Data Persistence**: System saves business information to Supabase businesses table with generated business_id and business_slug
- **Validation**: System validates all required fields before allowing progression
- **Error Handling**: Display specific error messages if save fails

**Step 3: Services Setup**
- Create service categories
- Add services with name, description, price, duration, category and image
- Assign services as available for online booking
- Configure optional add-ons and deposit requirements
- **Data Persistence**: System saves each service to Supabase services table linked to business_id
- **Validation**: Ensure at least one service is created before proceeding

**Step 4: Staff Setup**
- Add staff members with name, email and photo
- Assign services to each staff member
- Send invitation emails to staff
- **Data Persistence**: System saves staff members to Supabase staff table linked to business_id
- **Validation**: Ensure at least one staff member is added before proceeding

**Step 5: Working Hours**
- Configure business opening hours for each day
- Configure individual staff working hours
- Add breaks and blocked times
- **Data Persistence**: System saves working hours to Supabase working_hours table linked to business_id

**Step 6: Subscription Selection**
- Display available plans (Basic and Premium)
- Highlight 14-day free trial with Premium features
- User selects plan or starts trial
- Redirect to Stripe Checkout for payment method setup
- **Data Persistence**: System creates subscription record in Supabase subscriptions table

**Step 7: App Link & QR Code**
- System generates unique public app URL: /app/{business-slug}
- System generates downloadable QR code linking to public app URL
- Display shareable app link
- Provide printable QR poster
- Display quick start tips
- **Final Validation**: System verifies all onboarding data is saved successfully
- **Completion**: System marks onboarding as complete and redirects user to Business Owner Dashboard
- **Error Prevention**: If any step data is missing, system prevents completion and redirects user to the incomplete step

### 3.3 Multi-Language Support

**Supported Languages**:
- English (default)
- Greek
- Russian
- Hindi
- Arabic

**Language Selection**:
- User selects preferred language during account creation
- User can change language in profile settings
- System stores language preference in user profile
- System applies selected language to all interface elements

**Localization Scope**:
- All interface labels, buttons, menus and navigation
- Form field labels and placeholders
- Error messages and validation messages
- Email templates (confirmation, reminders, notifications)
- SMS templates
- System-generated messages
- Date and time formats according to language locale
- Currency display according to business country
- All pages and navigation elements must display in selected language

**Right-to-Left (RTL) Support**:
- Arabic interface automatically applies RTL layout
- Mirror navigation, forms and content alignment
- Preserve LTR for numbers, dates and technical terms

**Language Switching**:
- User can switch language from profile settings
- System immediately applies new language to all pages and navigation without page reload
- System preserves all user data and session state

### 3.4 Public Business App (/app/{business-slug})

**Access Method**:
- Customer scans business's QR code or visits app link
- System displays Authentication Gate as landing page

**Authentication Gate (Landing Page)**:

*Display Information*:
- Business logo (uploaded by owner or default scissors icon)
- Business name
- Welcome message

*Language Display*:
- Detect customer browser language and display matching language if supported
- Provide language selector for customer to change language

*Actions*:
- Click \"Sign In\" to go to Sign In page for this business
- Click \"Create Account\" to go to Sign Up page for this business
- Click \"Continue as Guest\" to proceed to Business Dashboard Page without account

**Sign Up (for this business)**:
- Customer enters name, email and password
- System creates customer account linked to this business only
- System saves customer to Supabase customers table with business_id
- System sends verification email
- Customer verifies email and proceeds to Business Dashboard Page
- **RLS Policy**: System allows public insertions into customers table during sign up flow

**Sign In (for this business)**:
- Customer enters email and password
- System authenticates customer for this business
- System redirects to Business Dashboard Page

**Business Dashboard Page**:

*Display Information*:
- Business logo (uploaded by owner or default scissors icon)
- Business name
- Business photos uploaded by owner
- Business description
- Address with embedded map showing business location and directions
- Phone number
- Email address
- Opening hours
- All active services grouped by category with name, description, price, duration and image
- All active products with name, image, price and description
- Quick action button: \"New Appointment\"

*Language Display*:
- Display content in customer's selected language

*Actions*:
- Click \"New Appointment\" to go to Booking Page
- Click service to view details
- Click product to view details
- If registered customer: Access \"My Appointments\" to view upcoming appointments and appointment history
- If registered customer: Access \"Profile Settings\" to manage profile and preferences
- If guest: Limited to viewing information and booking appointments

**New Appointment (Booking Page)**:

*Booking Flow*:
1. Customer selects one or multiple services
2. Customer selects service combination (predefined package or custom selection)
3. Customer selects a specific professional or \"Any available professional\"
4. Customer selects date from calendar
5. System displays available time slots based on availability engine
6. Customer selects time slot
7. If customer is signed in: System pre-fills customer details
8. If customer is guest: Customer enters name, phone, email and optional notes
9. Customer accepts privacy policy and booking terms
10. System displays booking summary with total estimated price, duration and selected professional
11. Customer confirms booking
12. System saves appointment to Supabase appointments table
13. If customer is guest: System creates customer record in Supabase customers table with business_id
14. System displays booking confirmation with reference number, appointment details and secure management link
15. System sends confirmation email in customer's selected language

*Service Combination Selection*:
- Display predefined service packages created by business owner
- Allow customer to select individual services and create custom combination
- Display total duration and total price for selected combination
- Validate that selected staff member is assigned to all selected services

*No Availability Handling*:
When selected professional has no available slots, display message in selected language: \"Unfortunately, there are no available appointments with this professional for the selected date. Please choose another date, another professional, or view the next available appointment.\"

Provide action buttons:
- View next available time
- Select another date
- Select another professional
- Select any available professional

*RLS Policy for Guest Booking*:
- System allows public or authenticated insertions into customers table during booking flow
- System associates customer record with business_id
- System enforces tenant isolation at database level

### 3.5 Business Owner Dashboard

**Dashboard Overview**:

Display key metrics:
- Today's appointments count (pending, confirmed, completed, cancelled, no-shows)
- Expected revenue today
- Monthly revenue
- New customers this month
- Returning customers this month
- Low-stock products alert
- Subscription status (trial days remaining or active plan)

Display lists:
- Today's appointments with time, customer name, service and status
- Upcoming appointments (next 7 days)

Quick actions:
- New appointment
- Add customer
- Add service
- Add employee
- Block time
- View public app
- Share QR code
- Download QR poster

**Calendar**:
- Display appointments in calendar view (day, week, month)
- Filter by staff member
- Color-code by appointment status
- Click appointment to view details or edit
- Drag-and-drop to reschedule
- Click empty slot to create new appointment
- **Display appointments list below calendar**: Show all appointments for selected date or date range with customer name, service, staff, time, duration and status
- **Edit appointment from calendar page**: Click appointment in list below calendar to open edit dialog, modify details and save changes
- **Decline appointment from calendar page**: Click decline button on appointment in list below calendar, select decline reason, confirm decline, system updates appointment status to \"Cancelled by Business\" and sends notification to customer immediately

**Appointments**:

*Appointment List*:
- Display all appointments with filters (date range, status, staff, service)
- Show customer name, phone, service, staff, date, time, duration, price and status
- Actions: view details, edit, cancel, mark as completed, mark as no-show

*Create Appointment*:
- Select customer (existing or new)
- Select service(s) or service combination
- Select staff member or \"Any available\"
- Select date and time from available slots
- Add optional notes
- System calculates total duration and price
- Confirm and create appointment
- System saves appointment to Supabase appointments table
- System sends confirmation to customer in their preferred language

*Appointment Details*:
- Display full appointment information
- Display customer contact details
- Display service details and add-ons
- Display payment status and amount
- Display appointment status history
- Actions: edit, reschedule, cancel, mark status, record payment, send reminder

**Customers**:

*Customer List*:
- Display all customers registered at this business with search and filters
- Show name, phone, email, total appointments, last visit and status
- Actions: view profile, add appointment, edit, deactivate

*Add Customer*:
- Enter name, phone, email and optional notes
- Save customer to Supabase customers table linked to business_id

*Customer Profile*:
- Display customer information
- Display appointment history with dates, services and amounts
- Display total spent and visit count
- Actions: edit profile, create appointment, view history

**Staff**:

*Staff List*:
- Display all staff members with name, photo, assigned services and status
- Actions: view profile, edit, deactivate, set temporary inactive status

*Add Staff*:
- Enter name and email
- Upload photo
- Assign role (Manager or Employee)
- Assign services
- Configure working hours
- Set permissions
- Send invitation email in staff member's preferred language
- System saves staff to Supabase staff table linked to business_id

*Staff Profile*:
- Display staff information and photo
- Display assigned services
- Display working hours and breaks
- Display upcoming appointments
- Display current status (active or inactive)
- Actions: edit profile, manage schedule, manage permissions, view performance, set temporary inactive status

*Set Temporary Inactive Status*:
- Select staff member
- Set inactive start date
- Set inactive end date
- Enter reason for inactivity
- Confirm and save
- System updates staff status to \"Inactive\" for specified period
- System excludes staff member from booking availability during inactive period
- System automatically reactivates staff member on end date
- System sends reminder to owner before reactivation date

*Staff Schedule*:
- Configure individual working hours for each day
- Add breaks
- Add time off and holidays
- Block unavailable times
- System saves schedule to Supabase working_hours table

**Services**:

*Service Categories*:
- Create, edit and delete service categories
- System saves categories to Supabase service_categories table

*Service List*:
- Display all services grouped by category
- Show name, price, duration and status
- Actions: edit, duplicate, activate/deactivate, delete

*Add/Edit Service*:
- Enter service name
- Enter description
- Set price
- Set duration (in minutes)
- Select category
- Upload image
- Assign available staff members
- Set active/inactive status
- Enable/disable online booking
- Add optional add-ons with prices
- Set optional deposit requirement
- System saves service to Supabase services table linked to business_id

*Service Combinations*:
- Create predefined service packages
- Select multiple services to include in package
- Set package name and description
- Set package price
- Set package duration
- Assign available staff members
- Enable/disable package for online booking
- System saves package to Supabase service_packages table linked to business_id

**Products**:

*Product List*:
- Display all products with name, SKU, category, current stock, selling price and status
- Highlight low-stock products
- Actions: edit, adjust stock, view history, deactivate

*Add Product*:
- Enter product name
- Enter SKU
- Select category
- Enter cost price and selling price
- Enter current stock quantity
- Set minimum stock level
- Enter supplier name
- **Upload product image (required)**: Owner must upload at least one product image before saving product
- Set active/inactive status
- System saves product to Supabase products table linked to business_id
- **Validation**: System validates that product image is uploaded before allowing save

*Edit Product*:
- Modify product details
- **Upload or replace product image**: Owner can upload new image or replace existing image
- System saves changes to Supabase products table

*Stock Adjustments*:
- Select product
- Enter adjustment quantity (positive or negative)
- Select reason (purchase, sale, damage, return, correction)
- Add optional notes
- Record adjustment with timestamp
- System saves adjustment to Supabase stock_movements table

**Reports**:

*Revenue Reports*:
- Display revenue by day, week and month
- Display revenue by service
- Display revenue by employee
- Display revenue by product
- Filter by date range, employee, service, product and payment method
- Export to CSV or PDF

*Appointment Reports*:
- Display total appointments, completed, cancelled and no-shows
- Display most popular services
- Filter by date range and status
- Export to CSV or PDF

*Customer Reports*:
- Display new customers and returning customers
- Display customer retention metrics
- Filter by date range
- Export to CSV or PDF

*Employee Performance*:
- Display appointments completed per employee
- Display revenue generated per employee
- Filter by date range and employee
- Export to CSV or PDF

*Product Sales*:
- Display products sold with quantities and revenue
- Display low-stock products
- Filter by date range and product
- Export to CSV or PDF

*Expense Reports*:
- Display expenses by category
- Display total expenses
- Display revenue versus expenses
- Calculate estimated profit
- Filter by date range and category
- Export to CSV or PDF

**Business Settings**:

*Business Profile*:
- Edit business name, logo, cover image, description, phone, email and address
- Edit country, currency and timezone
- System saves changes to Supabase businesses table

*Public App Customization*:
- Upload business photos (displayed on Business Dashboard Page)
- Edit business description (displayed on Business Dashboard Page)
- Configure which information is visible on public app (phone, email, address, map)
- Set default language for public app
- System saves customization to Supabase business_settings table

*Working Hours*:
- Configure business opening hours for each day of the week
- Set closed days
- System saves working hours to Supabase working_hours table

*Booking Policies*:
- Set booking interval (e.g., 15, 30, 60 minutes)
- Set minimum booking notice (e.g., 2 hours, 1 day)
- Set maximum booking period (e.g., 30, 60, 90 days in advance)
- Enter cancellation policy text
- Enter terms and conditions
- System saves policies to Supabase business_settings table

*Notification Settings*:
- Configure email reminder timing (24 hours, 2 hours before)
- Configure SMS reminder timing
- Enable/disable reminder types
- System saves settings to Supabase business_settings table

*QR Code & App Link*:
- Display unique public app URL: /app/{business-slug}
- Display QR code image
- Provide downloadable QR code image
- Provide printable QR poster with business name and booking instructions
- Copy app link to clipboard
- Share app link via email, SMS or social media

*Branding* (Premium only):
- Customize public app colors
- Upload custom cover image
- Add custom footer text
- System saves branding to Supabase business_settings table

**Subscription & Billing**:

*Current Plan*:
- Display active plan name (Basic or Premium)
- Display trial status and days remaining
- Display plan features and limits
- Display next billing date and amount

*Upgrade/Downgrade*:
- Display available plans with features comparison
- Select new plan
- Redirect to Stripe Checkout or Customer Portal

*Payment Method*:
- Display current payment method
- Update payment method via Stripe Customer Portal

*Invoices*:
- Display all invoices with date, amount and status
- Download invoice PDF

### 3.6 Employee Dashboard

**My Schedule**:
- Display employee's personal calendar with assigned appointments
- View appointments by day, week or month
- View appointment details

**My Appointments**:
- Display list of assigned appointments
- Filter by date range and status
- Mark appointment status (arrived, in progress, completed)
- View customer details

**Time Off Requests**:
- Submit time off requests with start date, end date and reason
- View request status (pending, approved, rejected)
- System saves requests to Supabase time_off_requests table

**Profile Settings**:
- Edit personal information
- Upload profile photo
- Change password
- Select preferred language
- System saves changes to Supabase users table

### 3.7 Customer Portal

**My Appointments**:
- Display list of upcoming appointments at this business with date, time, service, staff and location
- Display appointment history with date, service, staff and amount paid
- Actions: view details, reschedule, cancel, repeat booking

**Reschedule Appointment**:
- Select new date and time from available slots
- Confirm reschedule
- System updates appointment in Supabase appointments table
- System sends updated confirmation in customer's preferred language

**Cancel Appointment**:
- Select cancellation reason
- Confirm cancellation
- System updates appointment status in Supabase appointments table
- System sends cancellation confirmation in customer's preferred language

**Profile Settings**:
- Edit name, phone and email
- Change password
- Select preferred language
- System saves changes to Supabase users table

**Reminder Preferences**:
- Enable/disable email reminders
- Enable/disable SMS reminders
- System saves preferences to Supabase customer_settings table

### 3.8 Guest Booking Management

Guests receive a secure, unique, non-guessable link after booking (e.g., /manage-booking/{random-token}).

**Accessible Actions**:
- View appointment details
- Reschedule appointment
- Cancel appointment
- Add appointment to calendar

### 3.9 Platform Admin Dashboard

**Admin Overview**:
- Display total businesses registered
- Display active trials count
- Display Basic subscriptions count
- Display Premium subscriptions count
- Display cancelled subscriptions count
- Display failed payments count
- Display monthly recurring revenue
- Display new businesses this month
- Display total appointments across all businesses
- Display email delivery statistics (sent, delivered, failed)
- Display SMS delivery statistics (sent, delivered, failed)

**Business Management**:
- Display list of all businesses with name, owner, plan, status and created date
- Search and filter businesses
- Actions: view business details, suspend business, delete business

**Subscription Management**:
- Display all subscriptions with business name, plan, status, next billing date and amount
- Filter by plan and status
- Actions: view subscription details, cancel subscription, refund payment

**Revenue Analytics**:
- Display platform revenue by month
- Display revenue by plan
- Display churn rate
- Export reports to CSV or PDF

**Support Requests**:
- Display support tickets submitted by business owners
- Filter by status (open, in progress, resolved)
- Actions: view ticket, reply, close ticket

**System Health**:
- Display system uptime
- Display database status
- Display email service status
- Display SMS service status
- Display Stripe integration status

**Audit Logs**:
- Display all critical actions with timestamp, user, action type and details
- Filter by date range, user and action type
- Export logs to CSV

## 4. Business Rules and Logic

### 4.1 Multi-Tenancy and Data Isolation

- Each business operates in a completely isolated workspace
- All business data (services, staff, customers, appointments, products, sales, expenses) must be associated with a unique business_id
- Database queries must filter by business_id to prevent cross-tenant data access
- Supabase Row Level Security policies must enforce tenant isolation at the database level
- Business owners can only access and manage their own business data
- Employees can only access data for the business they are assigned to
- Customers can only view their own appointments and profile at the business they registered with
- Platform admins can access all business data for management purposes

### 4.2 Data Persistence and Validation

**Onboarding Data Persistence**:
- Each onboarding step must save data to Supabase immediately upon step completion
- System validates data integrity before saving
- System returns specific error messages if save operation fails
- System prevents progression to next step if current step data is not saved successfully
- System tracks onboarding completion status in businesses table
- Upon final submission, system verifies all required data exists in database
- If any required data is missing, system redirects user to the incomplete step with error message
- Only after all data is verified, system marks onboarding as complete and redirects to Business Owner Dashboard

**General Data Operations**:
- All create, update and delete operations must save changes to Supabase immediately
- System validates data before saving
- System displays success or error messages after each operation
- System refreshes displayed data after successful save
- System logs all data operations for audit purposes

### 4.3 User Roles and Permissions

**Platform Admin**:
- Full access to platform admin dashboard
- Can view and manage all businesses
- Can view and manage all subscriptions
- Can access system health and audit logs
- Cannot access individual business dashboards unless explicitly granted

**Business Owner**:
- Full access to their own business dashboard
- Can manage business settings, services, staff, customers, appointments, products and reports
- Can view and manage subscription and billing
- Can invite and assign roles to managers and employees
- Can customize public app appearance and upload photos
- Can generate and share QR code and app link
- Cannot access other businesses' data
- Cannot access platform admin dashboard

**Manager**:
- Access to business dashboard with permissions assigned by owner
- Can manage appointments, customers and staff within assigned permissions
- Cannot modify business settings or subscription
- Cannot access other businesses' data

**Employee**:
- Access to employee dashboard only
- Can view assigned appointments and personal schedule
- Can mark appointment statuses
- Can submit time off requests
- Cannot access business settings, reports or other employees' data

**Registered Customer**:
- Access to customer portal at the business they registered with
- Can view and manage own appointments at this business
- Can update own profile and preferences
- Cannot access business dashboard or other customers' data
- Cannot access other businesses' apps without creating separate accounts

**Guest Customer**:
- Access to public business app
- Can book appointments without account
- Can manage bookings via secure token link
- Cannot access customer portal or business dashboard

### 4.4 Standalone Public App Access and Customer Account Isolation

- Each business has a unique public app URL: /app/{business-slug}
- Each business has a unique QR code linking to their public app URL
- Customer scans QR code or visits app link to access Authentication Gate for that specific business
- Customer chooses to sign in, create account or continue as guest for this business only
- When customer creates account, system saves customer record to Supabase customers table with business_id linking to this business
- Customer account is isolated to this business and appears in owner's customer list for this business only
- After authentication or continuing as guest, customer proceeds to Business Dashboard Page displaying all services, details, products and map with directions for that shop
- Registered customer can access \"My Appointments\" from Business Dashboard Page to view upcoming appointments and appointment history
- Customer cannot discover or access other businesses' apps from within the public app
- Customer must scan a different QR code or visit a different link to access another business's app
- If customer wants to book at another business, customer must create a separate account at that business or book as guest
- System generates business_slug during onboarding based on business name
- System ensures business_slug is unique across all businesses

### 4.5 RLS Policy for Public Booking Flow

- Supabase Row Level Security policies must allow public or authenticated insertions into customers table during public booking flow
- When guest customer books appointment, system creates customer record in customers table with business_id
- When registered customer books appointment, system uses existing customer record linked to business_id
- RLS policies enforce that customer records are associated with correct business_id
- RLS policies prevent cross-tenant data access
- System validates business_id before inserting customer record
- System returns specific error message if RLS policy violation occurs

### 4.6 Availability Engine

Available time slots must be calculated based on:
- Business opening hours for the selected date
- Selected employee's working hours for the selected date
- Existing appointments for the selected employee
- Total duration of selected service(s) or service combination
- Employee breaks
- Blocked times
- Employee holidays and time off
- Employee temporary inactive status (exclude staff during inactive period)
- Booking interval configured in business settings
- Minimum booking notice
- Maximum booking period
- Business timezone
- Service eligibility (only staff assigned to all selected services can be booked)

**Calculation Logic**:
1. Retrieve business opening hours for selected date
2. Retrieve employee working hours for selected date
3. Check employee temporary inactive status and exclude if inactive on selected date
4. Calculate available time windows by subtracting existing appointments, breaks and blocked times
5. Filter time windows that can accommodate the total service duration
6. Apply booking interval to generate discrete time slots
7. Apply minimum and maximum booking notice filters
8. Return only available time slots to the customer

**Double-Booking Prevention**:
- Before creating an appointment, recalculate availability on the server
- Validate that the selected time slot is still available
- Use database-level constraints or transactions to prevent concurrent bookings
- If the slot is no longer available, return an error and prompt the customer to select another time

### 4.7 Appointment Lifecycle

**Appointment Statuses**:
- Pending: Appointment created, awaiting confirmation
- Confirmed: Appointment confirmed by business or customer
- Arrived: Customer has arrived at the location
- In Progress: Service is being delivered
- Completed: Service completed successfully
- Cancelled by Customer: Customer cancelled the appointment
- Cancelled by Business: Business cancelled the appointment
- No Show: Customer did not arrive for the appointment
- Rescheduled: Appointment date/time changed

**Payment Statuses** (separate from appointment status):
- Unpaid: No payment received
- Deposit Paid: Partial payment (deposit) received
- Paid: Full payment received
- Refunded: Payment refunded to customer

**Status Transitions**:
- Pending → Confirmed → Arrived → In Progress → Completed
- Any status → Cancelled by Customer
- Any status → Cancelled by Business
- Confirmed → No Show (if customer does not arrive)
- Any status → Rescheduled (creates new appointment with new date/time)

### 4.8 Appointment Reminders

**Reminder Timing**:
- Confirmation: Sent immediately after booking
- First reminder: 24 hours before appointment
- Second reminder: 2 hours before appointment

**Reminder Channels**:
- Email (always enabled)
- SMS (if enabled and phone number provided)

**Reminder Language**:
- Send reminders in customer's preferred language
- Use localized date and time formats
- Use localized message templates

**Reminder Rules**:
- Use business timezone for scheduling reminders
- Do not send reminders for cancelled or completed appointments
- Do not send duplicate reminders
- Store reminder status (pending, sent, delivered, failed) with timestamp
- Store delivery status and failure reason for troubleshooting
- Use secure scheduled jobs or serverless cron jobs to trigger reminders

### 4.9 Customer Notification on Appointment Changes

**Notification Triggers**:
- Owner edits appointment details (date, time, service, staff)
- Owner declines appointment
- Owner cancels appointment
- Owner reschedules appointment

**Notification Delivery**:
- System sends notification to customer immediately after change or decline
- Notification is sent via email in customer's preferred language
- If SMS is enabled, system also sends SMS notification
- Notification includes updated appointment details or decline reason

**Notification Content**:
- For edits: Display original and updated appointment details
- For declines: Display decline reason and suggest rebooking
- For cancellations: Display cancellation reason and suggest rebooking
- For reschedules: Display new appointment details

### 4.10 Subscription and Billing

**Subscription Plans**:

*14-Day Free Trial*:
- Automatically grants Premium features for 14 days
- No payment required to start trial
- When trial expires, restrict Premium features but do not delete data
- Prompt owner to select a paid plan

*Basic Plan*:
- One business
- Limited staff (e.g., up to 5 staff members)
- Public standalone app
- QR code
- Services management
- Appointments management
- Customers management
- Email reminders
- Basic reports (revenue, appointments, customers)
- CSV exports

*Premium Plan*:
- All Basic features
- More staff (e.g., unlimited or up to 20 staff members)
- SMS reminders
- Advanced reports (employee performance, customer retention, revenue vs expenses)
- PDF and CSV exports
- Inventory management
- Expense tracking
- Waiting list
- Custom branding
- Priority support

**Billing Logic**:
- Use Stripe for recurring subscriptions
- Use Stripe Checkout for initial payment method setup
- Use Stripe Customer Portal for payment method updates, plan changes and cancellations
- Generate invoices automatically via Stripe
- Send invoice emails to business owner
- Handle failed payments by retrying and notifying owner
- Allow plan upgrades (prorated billing)
- Allow plan downgrades (effective at next billing cycle)
- Allow cancellations (access continues until end of billing period)

**Plan Limits Enforcement**:
- Store plan limits in a configurable settings table
- Check limits before allowing actions (e.g., adding staff, enabling SMS reminders)
- Display limit warnings when approaching limits
- Prompt upgrade when limits are reached

### 4.11 Service Pricing and Calculation

When customer selects services:
1. Calculate total duration by summing all selected service durations
2. Calculate total service price by summing all selected service prices
3. If customer selects a predefined service package, use package price and duration
4. Add prices of selected add-ons
5. Apply discounts (if any)
6. Calculate taxes based on business country and tax settings
7. Calculate deposit amount (if required)
8. Display final estimated price to customer

**Recalculation on Server**:
- Before confirming appointment, recalculate total duration and price on the server
- Validate that prices have not changed since customer started booking
- If prices changed, notify customer and request confirmation

### 4.12 Product Inventory Management

**Stock Movements**:
- Purchase: Increase stock
- Sale: Decrease stock
- Damage: Decrease stock
- Return: Increase stock
- Correction: Adjust stock (positive or negative)

**Low Stock Alerts**:
- When product stock falls below minimum stock level, display alert on dashboard
- Send notification to business owner

**Stock History**:
- Record all stock movements with timestamp, user, reason and quantity
- Display stock movement history for each product

**Product Image Requirement**:
- Owner must upload at least one product image when creating product
- System validates image upload before allowing product save
- Owner can upload or replace product image when editing product

### 4.13 Sales and Expenses Tracking

**Sales Recording**:
- Record service revenue when appointment is marked as completed and paid
- Record product revenue when product is sold
- Record discounts applied
- Record tips received
- Record taxes collected
- Record deposits received
- Record refunds issued
- Record payment method (cash, card, online)

**Expenses Recording**:
- Allow owner to manually record expenses
- Categorize expenses (rent, utilities, supplies, salaries, marketing, other)
- Enter description, supplier, amount, date and payment method
- Attach receipt image or file

**Financial Separation**:
- Customer payments (for services and products) are separate from SaaS subscription payments
- Subscription payments are handled by Stripe and recorded in the subscriptions table
- Customer payments are recorded in the sales table and associated with appointments or product sales

### 4.14 QR Code and App Link

**Generation**:
- When business completes onboarding, generate unique public app URL: /app/{business-slug}
- Generate QR code that links to the public app URL
- Store QR code image in Supabase Storage
- Provide downloadable QR code image
- Provide printable QR poster with business name and booking instructions

**Sharing**:
- Owner can copy app link from Business Settings → QR Code & App Link
- Owner can download QR code image
- Owner can share app link via email, SMS or social media
- Owner can print QR poster and display in physical location

**Customization**:
- Owner can upload business photos displayed on Business Dashboard Page
- Owner can edit business description displayed on Business Dashboard Page
- Owner can configure which information is visible on public app
- Owner can set default language for public app

### 4.15 Default Logo Handling

- If owner does not upload logo during onboarding, system displays default scissors icon
- Owner can upload custom logo later from Business Settings → Business Profile
- System replaces default icon with uploaded logo across all pages (dashboard, public app, QR poster)

### 4.16 UI Theme

- System uses light theme as default across all pages and dashboards
- Light theme applies to owner dashboard, employee dashboard, customer portal, public app and platform admin dashboard
- System does not provide dark mode option

## 5. Exceptions and Edge Cases

| Scenario | Handling |
|----------|----------|
| User tries to book an unavailable time slot | Recalculate availability on server; if slot is unavailable, return error in selected language and prompt user to select another time |
| Employee is double-booked due to concurrent requests | Use database-level constraints or transactions to prevent double-booking; reject second booking and notify user in selected language |
| Customer cancels appointment less than minimum notice period | Allow cancellation but display cancellation policy in selected language; optionally charge cancellation fee |
| Business trial expires | Restrict Premium features; display trial expiration notice in owner's language; prompt owner to select paid plan; do not delete data |
| Subscription payment fails | Retry payment automatically; send notification to owner in their language; if payment continues to fail, suspend account after grace period |
| Owner tries to add more staff than plan allows | Display limit reached message in owner's language; prompt owner to upgrade plan |
| Customer tries to book appointment beyond maximum booking period | Do not display dates beyond maximum period; display message in selected language explaining booking limit |
| Employee is on leave but still appears in booking page | Exclude employee from available staff list on booking page for leave dates |
| Employee is set to temporary inactive status | Exclude employee from available staff list on booking page during inactive period; automatically reactivate on end date; send reminder to owner before reactivation |
| Business changes timezone | Recalculate all future appointment times and reminder schedules using new timezone; notify customers of time changes in their language |
| Customer tries to reschedule to an unavailable time | Recalculate availability; if time is unavailable, return error in selected language and prompt customer to select another time |
| Owner deletes a service that has future appointments | Prevent deletion; display error message in owner's language; suggest deactivating service instead |
| Product stock becomes negative due to sale | Allow negative stock but display warning in owner's language; prompt owner to adjust stock |
| Guest customer loses booking management link | Provide \"Resend booking link\" option on public app using email or phone verification |
| User tries to access another business's data | Enforce Row Level Security; return access denied error in user's language; log unauthorized access attempt |
| Reminder job fails to send email or SMS | Log failure reason; retry sending; display failed reminders in admin dashboard |
| Owner uploads invalid file format for logo or image | Validate file type and size on upload; return error message in owner's language; display allowed formats |
| Owner uploads invalid file format for product image | Validate file type and size on upload; return error message in owner's language; display allowed formats; prevent product save until valid image is uploaded |
| Customer books multiple services with different staff | Calculate availability for each staff member separately; ensure all staff are available at the selected time |
| Business is suspended by platform admin | Disable access to business dashboard; display suspension notice in owner's language; disable public app |
| Owner tries to downgrade plan but exceeds new plan limits | Prevent downgrade; display message in owner's language explaining limit conflict; prompt owner to reduce usage before downgrading |
| Onboarding data fails to save to Supabase | Display specific error message in user's language; prevent progression to next step; log error details; allow user to retry save operation |
| User completes onboarding but system redirects back to creation module | Verify all onboarding data exists in database; if data is missing, identify incomplete step and redirect user to that step with error message; if all data exists, mark onboarding as complete and redirect to Business Owner Dashboard |
| User selects unsupported language | Default to English; log unsupported language request; notify platform admin |
| RTL language (Arabic) displays incorrectly | Apply RTL layout automatically; mirror navigation and content alignment; preserve LTR for numbers and dates |
| Customer selects service combination with staff not assigned to all services | Display error message in selected language; prompt customer to select another staff member or modify service selection |
| Customer books as guest but email already exists in system | Allow booking as guest; do not create duplicate customer account; link appointment to existing customer if email matches |
| Customer tries to access another business's public app | Allow access; customer can scan different QR codes or visit different links to access multiple businesses' apps |
| Customer creates account at one business and tries to book at another business | Require customer to create separate account at the new business or book as guest |
| Owner does not upload logo during onboarding | Display default scissors icon; allow owner to upload custom logo later from Business Settings |
| Customer scans QR code but business is suspended | Display message in selected language: \"This business is currently unavailable. Please contact the business directly for assistance.\" |
| RLS error when creating customer during booking | Ensure RLS policies allow public or authenticated insertions into customers table; validate business_id before insertion; return specific error message if policy violation occurs |
| Guest customer creates booking but customer record fails to save | Display error message in selected language; prevent appointment creation; log error details; prompt customer to retry booking |
| Customer signs up but account is not visible in owner's customer list | Verify customer record is saved with correct business_id; check RLS policies; refresh customer list; log data inconsistency |
| Registered customer cannot see appointment history | Verify customer is signed in; verify appointments are linked to correct business_id and customer_id; refresh page; check RLS policies |
| Owner edits appointment but customer does not receive notification | Verify notification settings are enabled; check email/SMS delivery status; log notification failure; retry sending notification |
| Owner declines appointment but customer does not receive notification | Verify notification settings are enabled; check email/SMS delivery status; log notification failure; retry sending notification |
| User switches language but some pages or navigation elements remain in old language | Ensure all pages and navigation elements are localized; verify translation coverage; refresh page; log missing translations |

## 6. Acceptance Criteria

1. Business owner completes onboarding by entering business information, adding at least one service, adding at least one staff member, configuring working hours, selecting a subscription plan, and all data is successfully saved to Supabase
2. System verifies all onboarding data exists in database before marking onboarding as complete
3. Upon successful onboarding completion, system redirects business owner to Business Owner Dashboard
4. System generates unique public app URL and QR code for the business during onboarding
5. Owner navigates to Business Settings → QR Code & App Link and views app link, QR code image, and download options
6. Owner downloads QR code image and printable QR poster
7. Customer scans business's QR code and system displays Authentication Gate as landing page
8. Customer views business logo, business name and welcome message on Authentication Gate
9. Customer clicks \"Create Account\" and system displays Sign Up page for this business
10. Customer enters name, email and password, and system creates customer account linked to this business
11. System saves customer record to Supabase customers table with business_id
12. System allows public insertions into customers table during sign up flow without RLS error
13. Customer verifies email and system redirects to Business Dashboard Page
14. Customer views business photos, description, address with map and directions, phone number, email, opening hours, all services grouped by category, and all products on Business Dashboard Page
15. Customer clicks \"New Appointment\" and system displays Booking Page with services, staff and available time slots
16. Customer selects service combination, staff member, date and time, and confirms booking
17. System saves appointment to Supabase appointments table
18. Customer receives appointment confirmation email in their selected language immediately after booking
19. Registered customer accesses \"My Appointments\" from Business Dashboard Page and views upcoming appointments and appointment history
20. Owner logs into Business Owner Dashboard and navigates to Customers page and views newly created customer in customer list for this business
21. Owner navigates to Calendar page and views appointments in calendar view
22. Owner views appointments list below calendar displaying all appointments for selected date with customer name, service, staff, time, duration and status
23. Owner clicks appointment in list below calendar and edits appointment details
24. System saves changes and sends notification to customer immediately in their preferred language
25. Owner clicks decline button on appointment in list below calendar, selects decline reason and confirms decline
26. System updates appointment status to \"Cancelled by Business\" and sends notification to customer immediately in their preferred language
27. Owner navigates to Products page and clicks \"Add Product\"
28. Owner enters product details and uploads product image
29. System validates product image upload and saves product to Supabase products table
30. Owner navigates to Staff page and clicks staff member profile
31. Owner clicks \"Set Temporary Inactive Status\" and selects inactive start date and end date
32. System updates staff status to \"Inactive\" for specified period and excludes staff from booking availability during inactive period
33. System automatically reactivates staff member on end date and sends reminder to owner before reactivation
34. User views all pages and navigation elements in light theme
35. User selects preferred language from profile settings
36. System immediately applies selected language to all pages and navigation elements without page reload
37. User switches language and verifies all interface labels, buttons, menus, navigation, form fields, error messages and system messages display in selected language

## 7. Out of Scope for This Release

- Multi-location support for businesses with multiple branches
- Loyalty programs and reward points
- Gift cards and vouchers
- Online payment processing during booking (deposits and full payments are recorded manually)
- Integration with accounting software (e.g., QuickBooks, Xero)
- Mobile native apps (iOS and Android)
- Video consultations or virtual appointments
- Advanced marketing automation (e.g., email campaigns, SMS campaigns)
- Customer reviews and ratings
- Social media integrations (e.g., Facebook, Instagram booking)
- Multi-language support beyond English, Greek, Russian, Hindi and Arabic
- Advanced analytics and business intelligence dashboards
- API for third-party integrations
- White-label or reseller capabilities
- Franchise or multi-business management for a single owner
- Advanced inventory features (e.g., batch tracking, expiration dates, suppliers management)
- Payroll and employee salary management
- Commission tracking for employees
- Membership and subscription packages for customers
- Automated waitlist management
- Customer segmentation and targeted promotions
- Integration with POS systems
- Advanced security features (e.g., two-factor authentication, IP whitelisting)
- Custom reporting builder
- Automated backup and restore functionality
- Centralized business directory or marketplace for customers to discover all businesses
- Cross-business customer accounts (customers must create separate accounts at each business)
- In-app messaging or chat between customers and businesses
- Dark mode or theme customization options