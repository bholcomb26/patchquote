# Quote Type Feature - Migration Instructions

## ✅ What's Been Added

### 1. Quote Type Toggle
- **Patch Only**: Quote patches without hat application
- **Patch + Press**: Quote patches with application to hats (existing behavior)

### 2. Database Changes
A new migration file has been created: `/app/supabase-add-quote-type.sql`

### 3. UI Enhancements
- **Quote Builder**: Toggle at top to switch between quote types
- **Conditional Fields**: Apply minutes and hat fields only show for Patch + Press
- **Dynamic Labels**: Quantity shows "patches" or "hats" based on type
- **Tier Pricing**: Active tier highlighted with "Active" badge
- **Upsell Nudge**: Shows savings if customer orders more
- **Copy Tier Pricing Only**: New button for quick tier pricing copy
- **Dashboard Filters**: Filter quotes by All / Patch Only / Patch + Press

### 4. Calculation Logic
- **Patch Only**: Calculates based on patches (no application labor)
- **Patch + Press**: Existing calculation (includes application)
- **Scripts**: SMS/DM/Phone scripts use correct units (patch vs hat)

## 🚀 How to Apply Changes

### Step 1: Run Database Migration

1. Go to your Supabase Dashboard: https://necseypzjwcdtgdxopmb.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Copy the contents of `/app/supabase-add-quote-type.sql`
4. Paste into SQL Editor and click **Run**
5. Verify success message

### Step 2: Test the Feature

The app is already running with the new changes!

#### Test Patch Only:
1. Go to **New Quote**
2. Select **"Patch Only"** at the top
3. Notice "Apply min/hat" and "Hats Supplied By" fields are hidden
4. Enter patch details and calculate
5. Results show pricing per patch
6. Copy scripts mention "patches" not "hats"

#### Test Patch + Press:
1. Select **"Patch + Press"** at the top
2. All fields appear (including hat application)
3. Calculate quote
4. Results show pricing per hat
5. Scripts mention "patch hats"

#### Test Dashboard Filters:
1. Go to **Dashboard**
2. Click filter buttons at top of Recent Quotes
3. Filter by Patch Only / Patch + Press / All

#### Test Tier Features:
1. Create a quote with qty 50
2. Notice the "24+" tier is highlighted as "Active"
3. See upsell message: "Add X more to reach next tier and save $Y per patch!"
4. Click **"Copy Tier Pricing Only"** button

## 📋 Migration SQL Script

```sql
-- Add quote_type column to existing quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS quote_type TEXT NOT NULL DEFAULT 'patch_press' 
CHECK (quote_type IN ('patch_only', 'patch_press'));

-- Make apply_minutes_per_hat nullable (not used for patch_only)
ALTER TABLE quotes 
ALTER COLUMN apply_minutes_per_hat DROP NOT NULL;

-- Make hats_supplied_by nullable (not used for patch_only)
ALTER TABLE quotes 
ALTER COLUMN hats_supplied_by DROP NOT NULL;

-- Add units_label for convenience
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS units_label TEXT DEFAULT 'hat';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_quotes_quote_type ON quotes(quote_type);

-- Update existing quotes (backwards compatible)
UPDATE quotes SET quote_type = 'patch_press' WHERE quote_type IS NULL;
```

## 🎯 Key Features

### Quote Type Memory
Your last selected quote type is remembered in localStorage, so you don't have to keep switching.

### Conditional UI
- **Patch Only**: Hides hat-specific fields
- **Patch + Press**: Shows all fields

### Dynamic Labeling
- Unit prices show "/patch" or "/hat"
- Quantity field shows "(patches)" or "(hats)"
- Scripts use correct terminology

### Tier Pricing Enhancements
- **Active Tier**: Highlighted with purple background and "Active" badge
- **Upsell Nudge**: Shows potential savings
- **Copy Tier Only**: Quick copy button for tier pricing text

### Dashboard Filtering
- Filter chips at top of Recent Quotes
- Click to filter by quote type
- Filtered in query for performance

## 📝 Notes

- All existing quotes default to "patch_press" (backwards compatible)
- No data loss - all existing quotes work as before
- Server-side calculations ensure accuracy
- Quote type is saved with each quote

## 🐛 Troubleshooting

### If migration fails:
- Check if columns already exist
- Run individual ALTER TABLE statements one at a time
- Verify RLS policies still work

### If app shows errors:
- Clear browser cache
- Restart Next.js server: `sudo supervisorctl restart nextjs`
- Check browser console for errors

## ✨ What's Next

You can now:
1. Quote patches only (no application)
2. Quote patches with application
3. See clear pricing per unit type
4. Filter quotes by type on dashboard
5. Get upsell suggestions automatically
6. Copy tier pricing quickly

The feature is fully integrated and ready to use!
