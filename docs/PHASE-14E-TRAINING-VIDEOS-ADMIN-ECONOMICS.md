# Phase 14E — Training Videos & Platform Economics

## Training videos

The final compressed MP4 walkthroughs are served from the public Supabase Storage bucket `training-videos`.
The application builds each public URL from `VITE_SUPABASE_URL`, so the production project reference never needs to be hard-coded.

Registered files:

- Calendar-Newappointment.mp4
- Createaccountguide.mp4
- CreateProducts.mp4
- Createservices.mp4
- Customerbookappointment.mp4
- CustomerHistory.mp4
- Designcustomerpage.mp4
- Discovershopfrommap.mp4
- Editstaff.mp4
- Homepage.mp4
- Marketingpage.mp4
- Postpage.mp4
- Reportspage.mp4
- Staffpersonalpage.mp4
- Trainingportal.mp4
- Velliqo AI.mp4

Videos appear in the public Courses library, Owner Training Portal, Staff Training where applicable, and directly inside matching feature lessons.

## Platform economics

Migration `00054_velliqo_training_video_financial_intelligence.sql` adds Platform Admin reporting RPCs for:

- actual paid Stripe invoice revenue for any selected date range;
- actual recorded AI requests, tokens and estimated provider cost;
- email and SMS usage with configured unit costs;
- configured payment processing costs;
- prorated fixed infrastructure cost;
- total operating cost, estimated contribution and margin;
- per-owner profitability rows;
- detailed AI provider/model usage ledger.

The `/admin` Economics tab can export platform summary, owner profitability and detailed AI usage to CSV.
