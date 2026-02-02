import { NextResponse } from 'next/server'
import { createSupabaseServer, getUser } from '../../../lib/supabase-server'
import {
  calculateCompleteQuote,
  calculateProfitFirstAllocations
} from '../../../lib/calculations'

// CORS helper
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''
    
    const supabase = await createSupabaseServer()
    const user = await getUser()

    if (!user) {
      return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Health check
    if (path === '' || path === 'health') {
      return handleCORS(NextResponse.json({ status: 'ok', user: user.email }))
    }

    // Get shop settings
    if (path === 'shop-settings') {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return handleCORS(NextResponse.json(data || null))
    }

    // Get profit first settings
    if (path === 'profit-first-settings') {
      const { data, error } = await supabase
        .from('profit_first_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return handleCORS(NextResponse.json(data || null))
    }

    // Get patch materials
    if (path === 'patch-materials') {
      const { data, error } = await supabase
        .from('patch_materials')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return handleCORS(NextResponse.json(data || []))
    }

    // Get customers
    if (path === 'customers') {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return handleCORS(NextResponse.json(data || []))
    }

    // Get quotes
    if (path === 'quotes') {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(name),
          material:patch_materials(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return handleCORS(NextResponse.json(data || []))
    }

    // Get single quote
    if (path.startsWith('quotes/')) {
      const quoteId = path.split('/')[1]
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(name, email, phone),
          material:patch_materials(*)
        `)
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return handleCORS(NextResponse.json(data))
    }

    // Get finished hat quotes
    if (path === 'finished-hat-quotes') {
      const { data, error } = await supabase
        .from('finished_hat_quotes')
        .select(`
          *,
          customer:customers(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return handleCORS(NextResponse.json(data || []))
    }

    // Get single finished hat quote
    if (path.startsWith('finished-hat-quotes/')) {
      const quoteId = path.split('/')[1]
      const { data, error } = await supabase
        .from('finished_hat_quotes')
        .select(`
          *,
          customer:customers(name, email, phone)
        `)
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return handleCORS(NextResponse.json(data))
    }

    return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  } catch (error) {
    console.error('GET Error:', error)
    return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
  }
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''
    const body = await request.json()

    const supabase = await createSupabaseServer()
    const user = await getUser()

    // Auth endpoints
    if (path === 'auth/signup') {
      const { email, password } = body
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) throw error
      return handleCORS(NextResponse.json({ user: data.user }))
    }

    if (path === 'auth/signin') {
      const { email, password } = body
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) throw error
      return handleCORS(NextResponse.json({ user: data.user }))
    }

    if (path === 'auth/signout') {
      await supabase.auth.signOut()
      return handleCORS(NextResponse.json({ success: true }))
    }

    // All other routes require auth
    if (!user) {
      return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Complete onboarding
    if (path === 'onboarding/complete') {
      const { shopSettings, profitFirstSettings } = body

      // Create shop settings
      const { error: shopError } = await supabase
        .from('shop_settings')
        .insert([{ ...shopSettings, user_id: user.id }])

      if (shopError) throw shopError

      // Create profit first settings
      const { error: profitError } = await supabase
        .from('profit_first_settings')
        .insert([{ ...profitFirstSettings, user_id: user.id }])

      if (profitError) throw profitError

      // Seed default materials
      const defaultMaterials = [
        {
          user_id: user.id,
          name: 'Standard Leatherette',
          sheet_width: 12,
          sheet_height: 24,
          sheet_cost: 7,
          default_machine_minutes_per_sheet: 12,
          default_cleanup_minutes_per_sheet: 5
        },
        {
          user_id: user.id,
          name: 'Premium Leatherette',
          sheet_width: 12,
          sheet_height: 24,
          sheet_cost: 15,
          default_machine_minutes_per_sheet: 12,
          default_cleanup_minutes_per_sheet: 5
        }
      ]

      await supabase.from('patch_materials').insert(defaultMaterials)

      return handleCORS(NextResponse.json({ success: true }))
    }

    // Update shop settings
    if (path === 'shop-settings') {
      const { error } = await supabase
        .from('shop_settings')
        .upsert([{ ...body, user_id: user.id }], { onConflict: 'user_id' })

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Update profit first settings
    if (path === 'profit-first-settings') {
      const { error } = await supabase
        .from('profit_first_settings')
        .upsert([{ ...body, user_id: user.id }], { onConflict: 'user_id' })

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Create patch material
    if (path === 'patch-materials') {
      const { data, error } = await supabase
        .from('patch_materials')
        .insert([{ ...body, user_id: user.id }])
        .select()
        .single()

      if (error) throw error
      return handleCORS(NextResponse.json(data))
    }

    // Create customer
    if (path === 'customers') {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...body, user_id: user.id }])
        .select()
        .single()

      if (error) throw error
      return handleCORS(NextResponse.json(data))
    }

    // Create/calculate quote - unified calculation for both quote types
    if (path === 'quotes' || path === 'quotes/calculate') {
      // Get shop settings
      const { data: shopSettings } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!shopSettings) {
        return handleCORS(NextResponse.json({ error: 'Shop settings not found' }, { status: 400 }))
      }

      // Get material
      const { data: material } = await supabase
        .from('patch_materials')
        .select('*')
        .eq('id', body.patch_material_id)
        .eq('user_id', user.id)
        .single()

      if (!material) {
        return handleCORS(NextResponse.json({ error: 'Material not found' }, { status: 400 }))
      }

      // Calculate using unified pricing engine
      const calculated = calculateCompleteQuote(body, shopSettings, material)

      // If just calculating, return results
      if (path === 'quotes/calculate') {
        return handleCORS(NextResponse.json(calculated))
      }

      // Otherwise, save quote
      const quoteToSave = {
        user_id: user.id,
        customer_id: body.customer_id,
        quote_type: body.quote_type || 'patch_press',
        qty: body.qty,
        patch_material_id: body.patch_material_id,
        patch_width_input: body.patch_width_input,
        patch_height_input: body.patch_height_input,
        unit_price: calculated.publishedPricePerPiece,
        true_cost_per_hat: calculated.trueCostPerPiece,
        total_price: calculated.totalPrice,
        setup_fee: calculated.setupFee,
        best_yield: calculated.bestYield,
        effective_yield: calculated.effectiveYield,
        tier_prices_json: calculated.tier_prices_json,
        quote_sms: calculated.quote_sms,
        quote_dm: calculated.quote_dm,
        quote_phone: calculated.quotePhone,
        status: body.status || 'draft'
      }

      const { data, error } = await supabase
        .from('quotes')
        .insert([quoteToSave])
        .select()
        .single()

      if (error) throw error
      return handleCORS(NextResponse.json(data))
    }

    // Create finished hat quote
    if (path === 'finished-hat-quotes' || path === 'finished-hat-quotes/calculate') {
      // Get shop settings
      const { data: shopSettings } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!shopSettings) {
        return handleCORS(NextResponse.json({ error: 'Shop settings not found' }, { status: 400 }))
      }

      // Calculate all fields
      const calculated = calculateFinishedHatQuote(body, shopSettings)

      // If just calculating, return results
      if (path === 'finished-hat-quotes/calculate') {
        return handleCORS(NextResponse.json(calculated))
      }

      // Otherwise, save quote
      const quoteToSave = {
        ...body,
        ...calculated,
        user_id: user.id
      }

      const { data, error } = await supabase
        .from('finished_hat_quotes')
        .insert([quoteToSave])
        .select()
        .single()

      if (error) throw error
      return handleCORS(NextResponse.json(data))
    }

    return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  } catch (error) {
    console.error('POST Error:', error)
    return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''
    const body = await request.json()

    const supabase = await createSupabaseServer()
    const user = await getUser()

    if (!user) {
      return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Update patch material
    if (path.startsWith('patch-materials/')) {
      const materialId = path.split('/')[1]
      const { error } = await supabase
        .from('patch_materials')
        .update(body)
        .eq('id', materialId)
        .eq('user_id', user.id)

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Update customer
    if (path.startsWith('customers/')) {
      const customerId = path.split('/')[1]
      const { error } = await supabase
        .from('customers')
        .update(body)
        .eq('id', customerId)
        .eq('user_id', user.id)

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Update quote status
    if (path.match(/quotes\/.*\/status/)) {
      const quoteId = path.split('/')[1]
      const { status } = body

      const { error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', quoteId)
        .eq('user_id', user.id)

      if (error) throw error

      // If marking as paid, get profit first allocations
      if (status === 'paid') {
        const { data: quote } = await supabase
          .from('quotes')
          .select('total_price')
          .eq('id', quoteId)
          .single()

        const { data: profitFirstSettings } = await supabase
          .from('profit_first_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (quote && profitFirstSettings) {
          const allocations = calculateProfitFirstAllocations(quote.total_price, profitFirstSettings)
          return handleCORS(NextResponse.json({ success: true, allocations }))
        }
      }

      return handleCORS(NextResponse.json({ success: true }))
    }

    // Update finished hat quote status
    if (path.match(/finished-hat-quotes\/.*\/status/)) {
      const quoteId = path.split('/')[1]
      const { status } = body

      const { error } = await supabase
        .from('finished_hat_quotes')
        .update({ status })
        .eq('id', quoteId)
        .eq('user_id', user.id)

      if (error) throw error

      // If marking as paid, get profit first allocations
      if (status === 'paid') {
        const { data: quote } = await supabase
          .from('finished_hat_quotes')
          .select('total_price')
          .eq('id', quoteId)
          .single()

        const { data: profitFirstSettings } = await supabase
          .from('profit_first_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (quote && profitFirstSettings) {
          const allocations = calculateProfitFirstAllocations(quote.total_price, profitFirstSettings)
          return handleCORS(NextResponse.json({ success: true, allocations }))
        }
      }

      return handleCORS(NextResponse.json({ success: true }))
    }

    return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  } catch (error) {
    console.error('PATCH Error:', error)
    return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''

    const supabase = await createSupabaseServer()
    const user = await getUser()

    if (!user) {
      return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Delete patch material
    if (path.startsWith('patch-materials/')) {
      const materialId = path.split('/')[1]
      const { error } = await supabase
        .from('patch_materials')
        .delete()
        .eq('id', materialId)
        .eq('user_id', user.id)

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Delete customer
    if (path.startsWith('customers/')) {
      const customerId = path.split('/')[1]
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
        .eq('user_id', user.id)

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Delete quote
    if (path.startsWith('quotes/')) {
      const quoteId = path.split('/')[1]
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId)
        .eq('user_id', user.id)

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Delete finished hat quote
    if (path.startsWith('finished-hat-quotes/')) {
      const quoteId = path.split('/')[1]
      const { error } = await supabase
        .from('finished_hat_quotes')
        .delete()
        .eq('id', quoteId)
        .eq('user_id', user.id)

      if (error) throw error
      return handleCORS(NextResponse.json({ success: true }))
    }

    return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  } catch (error) {
    console.error('DELETE Error:', error)
    return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
  }
}
