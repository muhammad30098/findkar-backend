const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({ origin: '*' }));
app.options('*', cors());
app.use(express.json());

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── Health ──
app.get('/', (req, res) => res.json({ status: 'FindKar live ✓' }));

// ══════════ SHOPS ══════════

// Register or update shop
app.post('/api/shops/register', async (req, res) => {
  try {
    const { owner_name, shop_name, city, phone, categories } = req.body;
    console.log('Register shop:', req.body);
    
    if (!owner_name || !shop_name || !city || !categories?.length) {
      return res.status(400).json({ ok: false, error: 'owner_name, shop_name, city, categories sab zaroori hain' });
    }

    // Check if shop already exists
    const { data: existing } = await sb
      .from('shops')
      .select('*')
      .eq('owner_name', owner_name)
      .maybeSingle();

    if (existing) {
      // Update
      const { data, error } = await sb
        .from('shops')
        .update({ shop_name, city, phone: phone || '', categories, is_active: true })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      console.log('Shop updated:', data.id);
      return res.json({ ok: true, data, updated: true });
    }

    // Insert new
    const { data, error } = await sb
      .from('shops')
      .insert([{ owner_name, shop_name, city, phone: phone || '', categories, is_active: true }])
      .select()
      .single();
    if (error) throw error;
    console.log('Shop created:', data.id);
    res.json({ ok: true, data });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get shop by owner name
app.get('/api/shops/me/:owner_name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.owner_name);
    const { data, error } = await sb
      .from('shops')
      .select('*')
      .eq('owner_name', name)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.json({ ok: false, data: null });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════ DEMANDS ══════════

// Post demand
app.post('/api/demands', async (req, res) => {
  try {
    const { customer_name, text, category, location, budget, budget_open } = req.body;
    console.log('Post demand:', req.body);
    if (!customer_name || !text || !category) {
      return res.status(400).json({ ok: false, error: 'customer_name, text, category zaroori hain' });
    }
    const { data, error } = await sb
      .from('demands')
      .insert([{ customer_name, text, category, location: location || 'Pakistan', budget: budget || null, budget_open: budget_open !== false }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    console.error('Demand error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get all demands
app.get('/api/demands', async (req, res) => {
  try {
    const { data, error } = await sb
      .from('demands')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get demands filtered by shop categories
app.get('/api/demands/for-shop/:shop_id', async (req, res) => {
  try {
    const { data: shop, error: se } = await sb
      .from('shops')
      .select('categories')
      .eq('id', req.params.shop_id)
      .single();
    if (se) throw se;

    const { data, error } = await sb
      .from('demands')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const filtered = (data || []).filter(d => shop.categories.includes(d.category));
    res.json({ ok: true, data: filtered });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get my demands
app.get('/api/demands/mine/:customer_name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.customer_name);
    const { data, error } = await sb
      .from('demands')
      .select('*')
      .eq('customer_name', name)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════ QUOTES ══════════

// Send quote
app.post('/api/quotes', async (req, res) => {
  try {
    const { demand_id, shop_id, shop_name, price, message } = req.body;
    if (!demand_id || !shop_id || !price) {
      return res.status(400).json({ ok: false, error: 'demand_id, shop_id, price zaroori hain' });
    }
    // Upsert — agar pehle se hai toh update
    const { data: existing } = await sb
      .from('quotes')
      .select('id')
      .eq('demand_id', demand_id)
      .eq('shop_id', shop_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await sb
        .from('quotes')
        .update({ price, message, status: 'pending' })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    }

    const { data, error } = await sb
      .from('quotes')
      .insert([{ demand_id, shop_id, shop_name, price, message }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get quotes for a demand
app.get('/api/quotes/demand/:demand_id', async (req, res) => {
  try {
    const { data, error } = await sb
      .from('quotes')
      .select('*')
      .eq('demand_id', req.params.demand_id)
      .order('price', { ascending: true });
    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get quotes by shop
app.get('/api/quotes/shop/:shop_id', async (req, res) => {
  try {
    const { data, error } = await sb
      .from('quotes')
      .select('*, demands(text, customer_name, category)')
      .eq('shop_id', req.params.shop_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Update quote status
app.patch('/api/quotes/:id', async (req, res) => {
  try {
    const { status, counter_price } = req.body;
    const update = { status };
    if (counter_price) update.price = counter_price;
    const { data, error } = await sb
      .from('quotes')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (status === 'accepted') {
      await sb.from('demands').update({ status: 'closed' }).eq('id', data.demand_id);
    }
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════ CHAT ══════════

// Send message
app.post('/api/chats', async (req, res) => {
  try {
    const { demand_id, quote_id, sender_name, sender_role, message } = req.body;
    if (!demand_id || !sender_name || !message) {
      return res.status(400).json({ ok: false, error: 'demand_id, sender_name, message zaroori hain' });
    }
    const { data, error } = await sb
      .from('chats')
      .insert([{ demand_id, quote_id: quote_id || null, sender_name, sender_role, message }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get messages
app.get('/api/chats/:demand_id/:quote_id', async (req, res) => {
  try {
    let query = sb.from('chats').select('*').eq('demand_id', req.params.demand_id);
    if (req.params.quote_id !== 'null') {
      query = query.eq('quote_id', req.params.quote_id);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════ STATS ══════════
app.get('/api/stats', async (req, res) => {
  try {
    const [d, s, q] = await Promise.all([
      sb.from('demands').select('customer_name, created_at'),
      sb.from('shops').select('id'),
      sb.from('quotes').select('id').eq('status', 'accepted')
    ]);
    const today = (d.data || []).filter(x => (Date.now() - new Date(x.created_at)) < 86400000).length;
    const users = new Set((d.data || []).map(x => x.customer_name)).size;
    res.json({
      ok: true,
      total_demands: (d.data || []).length,
      today, users,
      shops: (s.data || []).length,
      quotes: (q.data || []).length
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FindKar running on port ' + PORT));
