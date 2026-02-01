# Patch Hat QuoteKit

A full-stack, production-ready MVP web application for patch hat decorators. Mobile-first quoting tool with auto-calculated yields, tier pricing, profit-first bucket allocations, and comprehensive quote management.

## 🚀 Features

### Core Features
- ✅ **Authentication** - Supabase Auth with email/password
- ✅ **Onboarding Wizard** - 6-step setup for shop floor configuration
- ✅ **Shop Settings** - Configure rates, capacity, and defaults
- ✅ **Patch Materials** - Full CRUD for material inventory
- ✅ **Customer Management** - Track customers with notes
- ✅ **Quote Calculator** - Auto/manual yield calculation with rotation
- ✅ **Tier Pricing** - Automatic tier pricing generation (24, 48, 96, 144, 384, 768)
- ✅ **Copy/Paste Scripts** - SMS, DM, and Phone scripts with tier prices
- ✅ **Quote History** - Track draft, sent, and paid quotes
- ✅ **Profit First** - Bucket allocation percentages
- ✅ **Finished Hat Pricing** - Price finished hats with margin/markup methods

### Calculations (Exact to Spec)
- Shop floor rate calculation (hourly & per-minute)
- Auto-yield calculation with patch rotation
- Manual yield override
- Material and labor cost per patch
- True cost per hat
- Unit pricing with configurable margin
- Rush pricing
- Rounding (nickels for unit, dollars for total)
- All calculations happen server-side (source of truth)

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router) + React
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **ORM**: Direct Supabase client (no ORM)
- **Deployment**: Vercel-ready

## 📋 Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Yarn package manager

## 🔧 Setup Instructions

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your credentials from **Settings → API**:
   - Project URL: `https://your-project.supabase.com`
   - Anon Key: `eyJhbGc...`

3. Run the database migration:
   - Open **SQL Editor** in your Supabase dashboard
   - Copy the entire contents of `/app/supabase-migrations.sql`
   - Paste into SQL Editor and click **Run**
   - Verify tables are created in **Table Editor**

4. Configure Authentication URLs:
   - Go to **Authentication → URL Configuration**
   - Add these redirect URLs:
     - `http://localhost:3000/**`
     - `http://localhost:3000/auth/callback`
     - Add your production URL when deploying

### 2. Environment Setup

The `.env` file is already configured with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://necseypzjwcdtgdxopmb.supabase.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Install Dependencies

```bash
cd /app
yarn install
```

### 4. Run the Application

```bash
yarn dev
```

The app will be available at `http://localhost:3000`

## 📱 Using the Application

### First Time Setup

1. **Sign Up**: Create an account with email and password
2. **Onboarding Wizard**: Complete the 6-step setup:
   - Step 1: Monthly targets (owner pay, profit goals)
   - Step 2: Overhead costs
   - Step 3: Capacity (hours/week, efficiency %)
   - Step 4: Apply time per hat
   - Step 5: Layout defaults (gap, border, waste, outline)
   - Step 6: Review and complete

3. **Default Materials Created**: 
   - Standard Leatherette ($7/sheet)
   - Premium Leatherette ($15/sheet)

### Creating Quotes

1. Go to **New Quote** in the navigation
2. Fill in job details:
   - Customer (optional)
   - Quantity
   - Material
   - Patch dimensions
3. Choose yield method:
   - **Auto-calc**: Automatically calculates best yield with rotation
   - **Manual**: Enter your actual yield
4. Configure timing and pricing
5. Click **Calculate Quote**
6. Review results:
   - Unit price and total
   - Yield calculations
   - Tier pricing table
   - Copy SMS/DM/Phone scripts
7. Save as **Draft** or **Mark as Sent**

### Finished Hat Pricing

For pre-finished hats with patches applied:
1. Go to **Finished Hats** in navigation
2. Click **New Finished Hat Quote**
3. Enter:
   - Hat name and quantity
   - Costs (hat, shipping, patch)
   - Labor minutes
   - Choose pricing method:
     - **Margin %**: Traditional margin-based pricing
     - **Markup ×**: Simple cost multiplier
4. Calculate and save

### Mark as Paid

When a quote is paid:
1. Click quote in Dashboard
2. Click **Mark as Paid**
3. View Profit First bucket allocations:
   - Profit account
   - Tax reserve
   - Owner pay
   - Operations
   - Buffer

## 🗂 Database Schema

All tables with Row Level Security (RLS) enabled:

- `shop_settings` - Shop floor configuration per user
- `profit_first_settings` - Bucket allocation percentages
- `patch_materials` - Material inventory
- `customers` - Customer contacts
- `quotes` - Patch hat quotes with computed fields
- `finished_hat_quotes` - Finished hat pricing quotes

## 🧮 Calculation Examples

### Shop Rate
```
Workable hours/month = 30 hrs/week × 4.33 = 129.9 hours
Billable hours/month = 129.9 × 70% = 90.93 hours
Required monthly = $750 + $2400 + $1000 = $4,150
Shop rate = $4,150 ÷ 90.93 = $45.64/hr
Minute rate = $45.64 ÷ 60 = $0.76/min
```

### Auto Yield (with rotation)
```
Sheet: 12×24", Patch: 3.25×2.25", Gap: 0.0625", Border: 0.25"

Normal: floor((11.5 + 0.0625) / (3.25 + 0.0625)) × floor((23.5 + 0.0625) / (2.25 + 0.0625)) = 3 × 10 = 30
Rotated: floor((11.5 + 0.0625) / (2.25 + 0.0625)) × floor((23.5 + 0.0625) / (3.25 + 0.0625)) = 5 × 7 = 35
Best yield = 35 patches/sheet
```

## 🚀 Deployment (Vercel)

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-production-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Update Supabase redirect URLs with your Vercel URL
5. Deploy!

## 📝 API Endpoints

All endpoints are in `/app/api/[[...path]]/route.js`:

### Authentication
- `POST /api?path=auth/signup` - Create account
- `POST /api?path=auth/signin` - Sign in
- `POST /api?path=auth/signout` - Sign out

### Settings
- `GET /api?path=shop-settings` - Get shop settings
- `POST /api?path=shop-settings` - Update shop settings
- `GET /api?path=profit-first-settings` - Get profit first settings
- `POST /api?path=profit-first-settings` - Update profit first settings

### Materials & Customers
- `GET /api?path=patch-materials` - List materials
- `POST /api?path=patch-materials` - Create material
- `PATCH /api?path=patch-materials/:id` - Update material
- `DELETE /api?path=patch-materials/:id` - Delete material
- `GET /api?path=customers` - List customers
- `POST /api?path=customers` - Create customer
- (similar CRUD for customers)

### Quotes
- `GET /api?path=quotes` - List quotes
- `POST /api?path=quotes/calculate` - Calculate quote (no save)
- `POST /api?path=quotes` - Save quote
- `PATCH /api?path=quotes/:id/status` - Update status (mark paid)

### Finished Hat Quotes
- `GET /api?path=finished-hat-quotes` - List finished hat quotes
- `POST /api?path=finished-hat-quotes/calculate` - Calculate (no save)
- `POST /api?path=finished-hat-quotes` - Save quote
- `PATCH /api?path=finished-hat-quotes/:id/status` - Update status

## 🎨 UI Components

Built with shadcn/ui:
- Cards, Buttons, Inputs, Labels
- Select dropdowns
- Tabs for mode switching
- Badges for status
- Progress bars
- Toasts for notifications

## 🔒 Security

- Row Level Security (RLS) on all tables
- Users can only access their own data
- Server-side calculations (no client manipulation)
- Authenticated API routes
- Secure password handling via Supabase Auth

## 🐛 Troubleshooting

### Server Won't Start
```bash
sudo supervisorctl restart nextjs
tail -f /var/log/supervisor/nextjs.out.log
```

### Database Connection Issues
- Verify Supabase URL and anon key in `.env`
- Check Supabase dashboard is accessible
- Ensure tables are created (run migration)

### Auth Not Working
- Verify redirect URLs in Supabase dashboard
- Check browser console for errors
- Try clearing cookies and cache

## 📄 Files Structure

```
/app/
├── app/
│   ├── api/[[...path]]/route.js    # Backend API
│   ├── page.js                      # Main app with navigation
│   ├── dashboard.js                 # Dashboard page
│   ├── onboarding-wizard.js         # 6-step wizard
│   ├── shop-settings.js             # Shop configuration
│   ├── patch-materials.js           # Materials CRUD
│   ├── customers-page.js            # Customers CRUD
│   ├── quote-builder.js             # Main quote calculator
│   ├── finished-hat-pricing.js      # Finished hat quotes
│   ├── profit-first.js              # Profit first settings
│   └── layout.js                    # Root layout
├── lib/
│   ├── supabase-client.js          # Browser Supabase client
│   ├── supabase-server.js          # Server Supabase client
│   └── calculations.js             # All calculation functions
├── components/ui/                   # shadcn components
├── supabase-migrations.sql          # Database schema
├── .env                             # Environment variables
└── README.md                        # This file
```

## 🎯 Next Steps

After MVP:
- Export quotes to PDF
- Email quotes directly
- Quote templates
- Multi-material quotes
- Discount codes
- Reporting dashboard
- Inventory tracking

## 📞 Support

For issues or questions:
1. Check logs: `tail -f /var/log/supervisor/nextjs.out.log`
2. Review Supabase dashboard for database issues
3. Check browser console for frontend errors

## 📜 License

Proprietary - All rights reserved

---

**Built with ❤️ for patch hat decorators**
