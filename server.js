const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({ origin: '*' }));
app.options('*', cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get('/api/demands', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('demands').select('*')
      .order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/demands', async (req, res) => {
  try {
    const { user_name, text, category, location, budget } = req.body;
    if (!user_name || !text)
      return res.status(400).json({ ok: false, error: 'Fields missing' });
    const { data, error } = await supabase.from('demands')
      .insert([{ user_name, text, category: category||'general', location: location||'Pakistan', budget: budget||'Open' }])
      .select().single();
    if (error) throw error;
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'FindKar backend live ✓' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FindKar running on port ' + PORT));
