const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Keys sirf yahan hain — browser tak kabhi nahi jaatein
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── GET all demands ──
app.get('/api/demands', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('demands')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST new demand ──
app.post('/api/demands', async (req, res) => {
  try {
    const { user_name, text, category, location, budget } = req.body;
    if (!user_name || !text) {
      return res.status(400).json({ ok: false, error: 'user_name aur text zaroori hai' });
    }
    const { data, error } = await supabase
      .from('demands')
      .insert([{ user_name, text, category: category || 'general', location: location || 'Pakistan', budget: budget || 'Open' }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET stats ──
app.get('/api/stats', async (req, res) => {
  try {
    const { data, error } = await supabase.from('demands').select('user_name, created_at');
    if (error) throw error;
    const today = data.filter(d => (Date.now() - new Date(d.created_at)) < 86400000).length;
    const users = new Set(data.map(d => d.user_name)).size;
    res.json({ ok: true, total: data.length, today, users });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Health check ──
app.get('/', (req, res) => res.json({ status: 'FindKar backend live ✓' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FindKar server running on port ${PORT}`));
