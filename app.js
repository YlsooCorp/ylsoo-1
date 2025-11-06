// =======================
// YLSOO MAIN SERVER
// =======================

const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const path = require('path');
const os = require('os');
const Stripe = require('stripe');


// =======================
// APP CONFIGURATION
// =======================
const app = express();
const PORT = process.env.PORT || 3000;
let serverStart = Date.now();

// =======================
// YLSOO CORE CONNECTION
// =======================
const ylsooCoreUrl = process.env.SUPABASE_URL || 'https://qjnwvmzrwxdtvapsuzgc.supabase.co';
const ylsooCoreKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbnd2bXpyd3hkdHZhcHN1emdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1Nzc1NDEsImV4cCI6MjA2NzE1MzU0MX0.GCwssdY5oogs6fdxs3q7WlBhbNKtYZN1iaVh1iUEBd8';
const ylsooCore = createClient(ylsooCoreUrl, ylsooCoreKey);

// =======================
// RESEND EMAIL SETUP
// =======================
const resend = new Resend(process.env.RESEND_API_KEY || 're_WcsD7pZb_KnF9pLteArDaj2Q1gfKDebw3');

// =======================
// STRIPE SETUP
// =======================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_yourstripekey');


// =======================
// MIDDLEWARE
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ylsoo-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// =======================
// VIEW ENGINE
// =======================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =======================
// AUTH MIDDLEWARE
// =======================
const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// =======================
// BASIC ROUTES
// =======================
app.get('/', (req, res) => res.render('index', { user: req.session.user || null }));

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('signup', { error: null });
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});
// =======================
// CAREERS PAGE
// =======================
app.get('/careers', async (req, res) => {
  try {
    const { data: jobs, error } = await ylsooCore
      .from('careers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.render('careers', { user: req.session.user || null, jobs });
  } catch (err) {
    console.error('Error loading careers:', err.message);
    res.render('careers', { user: req.session.user || null, jobs: [] });
  }
});

// =======================
// TEAM PAGE
// =======================
app.get('/team', async (req, res) => {
  try {
    const { data: team, error } = await ylsooCore
      .from('team')
      .select('*')
      .order('joined_year', { ascending: false });

    if (error) throw error;

    res.render('team', { user: req.session.user || null, team });
  } catch (err) {
    console.error('Error loading team:', err.message);
    res.render('team', { user: req.session.user || null, team: [] });
  }
});

// Single Job Page
app.get('/careers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: job, error } = await ylsooCore
      .from('careers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Dynamic requirement message based on location
    let requirementNote = 'General qualifications apply.';
    const loc = job.location?.toLowerCase() || '';

    if (loc.includes('germany') || loc.includes('berlin')) {
      requirementNote = 'A university degree or equivalent professional experience is required in Germany.';
    } else if (loc.includes('united states') || loc.includes('usa') || loc.includes('america')) {
      requirementNote = 'Bachelor’s degree preferred; relevant professional experience accepted.';
    } else if (loc.includes('united kingdom') || loc.includes('london') || loc.includes('uk')) {
      requirementNote = 'Applicants must have the legal right to work in the UK.';
    } else if (loc.includes('remote')) {
      requirementNote = 'Requirements may vary by region — flexibility based on experience.';
    } else if (loc.includes('canada')) {
      requirementNote = 'Bachelor’s degree or equivalent experience preferred; bilingual English/French a plus.';
    } else if (loc.includes('france') || loc.includes('paris')) {
      requirementNote = 'Fluency in English and French and a related degree are typically required.';
    }

    res.render('career-entry', {
      user: req.session.user || null,
      job,
      requirementNote
    });
  } catch (err) {
    console.error('Error loading job:', err.message);
    res.status(404).render('404', { user: req.session.user || null });
  }
});



// =======================
// STATIC PAGES (LEGAL, ABOUT, CONTACT)
// =======================
app.get('/terms', (req, res) => res.render('terms', { user: req.session.user || null }));
app.get('/privacy', (req, res) => res.render('privacy', { user: req.session.user || null }));
app.get('/cookies', (req, res) => res.render('cookies', { user: req.session.user || null }));
app.get('/about', (req, res) => res.render('about', { user: req.session.user || null }));
app.get('/contact', (req, res) => res.render('contact', { user: req.session.user || null }));

// =======================
// PARTNERS PAGE
// =======================
app.get('/partners', async (req, res) => {
  try {
    const { data: partners, error } = await ylsooCore.from('partners').select('*').order('id');
    if (error) throw error;
    res.render('partners', { user: req.session.user || null, partners });
  } catch (err) {
    console.error('Partners error:', err);
    res.render('partners', { user: req.session.user || null, partners: [] });
  }
});

// =======================
// JOURNEY PAGE
// =======================
app.get('/journey', async (req, res) => {
  try {
    const { data: milestones, error } = await ylsooCore
      .from('journey')
      .select('*')
      .order('year', { ascending: true });
    if (error) throw error;
    res.render('journey', { user: req.session.user || null, milestones });
  } catch (err) {
    console.error('Journey error:', err);
    res.render('journey', { user: req.session.user || null, milestones: [] });
  }
});

// =======================
// TRUST CENTER
// =======================
app.get('/trust', (req, res) => res.render('trust', { user: req.session.user || null }));

// =======================
// STORIES SYSTEM
// =======================
app.get('/stories', async (req, res) => {
  try {
    const { data: stories, error } = await ylsooCore.from('stories').select('*').order('id');
    if (error) throw error;
    res.render('stories', { user: req.session.user || null, stories });
  } catch (err) {
    console.error('Stories error:', err);
    res.render('stories', { user: req.session.user || null, stories: [] });
  }
});

// =======================
// BILLING PAGE
// =======================
app.get('/billing', requireAuth, async (req, res) => {
  const { data: methods } = await ylsooCore
    .from('billing_methods')
    .select('*')
    .eq('user_id', req.session.user.id);
  res.render('billing', {
    user: req.session.user,
    methods: methods || [],
    stripe_pk: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});


// =======================
// STRIPE CREATE SETUP INTENT
// =======================
app.post("/api/create-setup-intent", requireAuth, async (req, res) => {
  try {
    // Create or reuse Stripe customer
    let customerId = req.session.user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.session.user.email,
        name: req.session.user.name || "Ylsoo User",
      });

      customerId = customer.id;
      req.session.user.stripe_customer_id = customerId;

      // Store in database for reuse (optional)
      await ylsooCore
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", req.session.user.id);
    }

    // Create a SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    // Return the client_secret to the browser
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error("Stripe SetupIntent error:", err.message);
    res.status(500).json({ error: "Failed to create setup intent" });
  }
});

// =======================
// STRIPE SAVE PAYMENT METHOD
// =======================
app.post('/api/save-payment-method', requireAuth, async (req, res) => {
  const { payment_method_id } = req.body;
  const userId = req.session.user.id;

  try {
    const { data: record } = await ylsooCore
      .from('billing_methods')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    const customerId = record?.stripe_customer_id;
    if (!customerId) throw new Error('Customer not found');

    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    const pm = await stripe.paymentMethods.retrieve(payment_method_id);

    await ylsooCore.from('billing_methods').insert({
      user_id: userId,
      stripe_customer_id: customerId,
      payment_method_id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Save payment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// OPTIONAL 1¢ AUTH + REFUND
// =======================
app.post('/api/verify-charge', requireAuth, async (req, res) => {
  const { payment_method_id } = req.body;

  try {
    const { data: record } = await ylsooCore
      .from('billing_methods')
      .select('stripe_customer_id')
      .eq('user_id', req.session.user.id)
      .single();

    const customerId = record?.stripe_customer_id;
    if (!customerId) throw new Error('Customer not found');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1, // 1 cent
      currency: 'usd',
      customer: customerId,
      payment_method: payment_method_id,
      confirm: true,
      off_session: true,
    });

    if (paymentIntent.status === 'succeeded') {
      await stripe.refunds.create({ payment_intent: paymentIntent.id });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Verify charge error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


app.get('/story/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: story, error } = await ylsooCore.from('stories').select('*').eq('id', id).single();
    if (error) throw error;
    res.render('story', { user: req.session.user || null, story });
  } catch {
    res.status(404).render('404', { user: req.session.user || null });
  }
});

// =======================
// SIGNUP & LOGIN
// =======================
app.post('/api/signup', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const { data, error } = await ylsooCore.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    req.session.user = { id: data.user.id, email: data.user.email, name };
    res.json({ success: true, redirect: '/dashboard' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await ylsooCore.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || email.split('@')[0]
    };
    req.session.user = user;

    // Track device/session
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    await ylsooCore.from('user_sessions').insert({
      user_id: user.id,
      device_name: userAgent.substring(0, 80),
      browser: userAgent,
      os: userAgent.includes('Mac') ? 'macOS' : userAgent.includes('Win') ? 'Windows' : 'Unknown',
      ip_address: ip
    });

    res.json({ success: true, redirect: '/dashboard' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, redirect: '/' });
});
// =======================
// LABS PROJECTS
// =======================
app.get('/labs', async (req, res) => {
  try {
    const { data: labs, error } = await ylsooCore
      .from('labs_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.render('labs', { user: req.session.user || null, labs });
  } catch (err) {
    console.error('Labs error:', err.message);
    res.render('labs', { user: req.session.user || null, labs: [] });
  }
});

// =======================
// BLOG SYSTEM
// =======================
app.get('/blog', async (req, res) => {
  try {
    const { data: posts, error } = await ylsooCore
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.render('blog', { user: req.session.user || null, posts });
  } catch (err) {
    console.error('Blog load error:', err.message);
    res.render('blog', { user: req.session.user || null, posts: [] });
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { data: post, error } = await ylsooCore
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error || !post) throw error || new Error('Not found');
    res.render('blog-post', { user: req.session.user || null, post });
  } catch (err) {
    console.error('Blog single error:', err.message);
    res.status(404).render('404', { user: req.session.user || null });
  }
});

// =======================
// ETHICAL AI PAGE
// =======================
app.get('/ethical-ai', async (req, res) => {
  try {
    const { data: pillars, error: pillarsError } = await ylsooCore
      .from('ethical_pillars')
      .select('*')
      .order('order_index', { ascending: true });
    if (pillarsError) throw pillarsError;

    const { data: principles, error: principlesError } = await ylsooCore
      .from('ethical_principles')
      .select('*')
      .order('order_index', { ascending: true });
    if (principlesError) throw principlesError;

    res.render('ethical-ai', {
      user: req.session.user || null,
      pillars,
      principles
    });
  } catch (err) {
    console.error('Ethical AI error:', err.message);
    res.render('ethical-ai', {
      user: req.session.user || null,
      pillars: [],
      principles: []
    });
  }
});

// =======================
// DEVICES PAGE
// =======================
app.get('/devices', requireAuth, async (req, res) => {
  try {
    const { data: sessions, error } = await ylsooCore
      .from('user_sessions')
      .select('*')
      .eq('user_id', req.session.user.id)
      .order('last_active', { ascending: false });
    if (error) throw error;
    res.render('devices', { user: req.session.user, sessions });
  } catch (err) {
    console.error('Devices error:', err.message);
    res.render('devices', { user: req.session.user, sessions: [] });
  }
});

app.post('/api/logout-session', requireAuth, async (req, res) => {
  const { session_id } = req.body;
  try {
    const { error } = await ylsooCore
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', session_id)
      .eq('user_id', req.session.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =======================
// ACCOUNT NOTIFICATIONS
// =======================
app.get('/account/notifications', requireAuth, async (req, res) => {
  try {
    const { data: preferences, error } = await ylsooCore
      .from('notification_preferences')
      .select('*')
      .eq('user_id', req.session.user.id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.render('account-notifications', {
      user: req.session.user,
      preferences: preferences || {
        email_updates: true,
        marketing_emails: false,
        security_alerts: true,
        product_announcements: true,
      }
    });
  } catch (err) {
    console.error('Notification prefs error:', err.message);
    res.render('account-notifications', {
      user: req.session.user,
      preferences: {
        email_updates: true,
        marketing_emails: false,
        security_alerts: true,
        product_announcements: true,
      }
    });
  }
});

app.post('/api/account/notifications', requireAuth, async (req, res) => {
  const { email_updates, marketing_emails, security_alerts, product_announcements } = req.body;
  try {
    const { error } = await ylsooCore
      .from('notification_preferences')
      .upsert({
        user_id: req.session.user.id,
        email_updates: email_updates === 'on',
        marketing_emails: marketing_emails === 'on',
        security_alerts: security_alerts === 'on',
        product_announcements: product_announcements === 'on',
      });
    if (error) throw error;
    res.redirect('/account/notifications');
  } catch (err) {
    console.error('Notification prefs save error:', err.message);
    res.status(500).send('Error saving preferences');
  }
});

// =======================
// NOTIFICATIONS PAGE
// =======================
app.get('/notifications', requireAuth, async (req, res) => {
  try {
    const { data: notifications, error } = await ylsooCore
      .from('notifications')
      .select('*')
      .eq('user_id', req.session.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.render('notifications', { user: req.session.user, notifications });
  } catch (err) {
    console.error('Notifications load error:', err.message);
    res.render('notifications', { user: req.session.user, notifications: [] });
  }
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
  const { id } = req.body;
  try {
    const { error } = await ylsooCore
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.session.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// CHANGELOG PAGE
// =======================

// List all changelog entries
app.get('/changelog', async (req, res) => {
  try {
    const { data: changelogs, error } = await ylsooCore
      .from('changelog_entries')
      .select('*')
      .order('release_date', { ascending: false });

    if (error) throw error;
    res.render('changelog', { user: req.session.user || null, changelogs });
  } catch (err) {
    console.error('Error loading changelog:', err.message);
    res.render('changelog', { user: req.session.user || null, changelogs: [] });
  }
});

// Single changelog entry
app.get('/changes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: entry, error } = await ylsooCore
      .from('changelog_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.render('changelog-entry', { user: req.session.user || null, entry });
  } catch (err) {
    console.error('Error loading changelog entry:', err.message);
    res.status(404).render('404', { user: req.session.user || null });
  }
});



// =======================
// CUSTOM ERROR HANDLING
// =======================

// 404 Page (Not Found)
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user || null });
});

// Generic Server Error
app.use((err, req, res, next) => {
  console.error('💥 Internal Server Error:', err.stack);
  res.status(500).render('error', {
    user: req.session.user || null,
    message: 'Something went wrong on our side.',
    error: err
  });
});


// =======================
// ACCOUNT SECURITY PAGE
// =======================
app.get('/account/security', requireAuth, (req, res) => {
  res.render('account-security', { user: req.session.user, message: null, error: null });
});

// Change Email
app.post('/api/account/change-email', requireAuth, async (req, res) => {
  const { newEmail } = req.body;
  try {
    const { error } = await ylsooCore.auth.updateUser({ email: newEmail });
    if (error) throw error;
    req.session.user.email = newEmail;
    res.render('account-security', { user: req.session.user, message: 'Email updated successfully!', error: null });
  } catch (err) {
    res.render('account-security', { user: req.session.user, message: null, error: err.message });
  }
});

// =======================
// PASSWORD RESET EMAIL (RESEND FIXED)
// =======================
app.post('/api/account/request-password-code', requireAuth, async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const userId = req.session.user.id;
  const email = req.session.user.email;
  const name = req.session.user.name || 'User';

  try {
    await ylsooCore.from('password_reset_codes').insert([{ user_id: userId, code }]);
    await resend.emails.send({
      from: 'Ylsoo Security <noreply@accts.ylsoo.com>',
      to: email,
      subject: 'Your Ylsoo Security Code',
      html: `
      <div style="font-family:Inter,Arial,sans-serif;background-color:#f8fafc;padding:0;margin:0;">
        <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <div style="background:linear-gradient(90deg,#0f172a,#1e293b);padding:24px;text-align:center;">
            <img src="https://ucarecdn.com/544489c7-f378-48ba-a2f1-d18c7dfb5e3f/1000001883removebgpreview.PNG" alt="Ylsoo Logo" style="max-width:140px;height:auto;" />
          </div>
          <div style="padding:32px 28px;">
            <h2 style="text-align:center;color:#111827;">Security Verification</h2>
            <p style="font-size:15px;line-height:1.6;color:#334155;">
              Hello ${name},<br><br>
              We received a request to change your Ylsoo account password.<br>
              Use the verification code below to continue:
            </p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;text-align:center;margin:24px 0;">${code}</div>
            <p style="font-size:14px;color:#475569;">This code expires in <strong>10 minutes</strong>.  
              If you didn’t request this change, please secure your account immediately.</p>
          </div>
          <div style="background:#f1f5f9;padding:20px;text-align:center;font-size:13px;color:#64748b;">
            <p>&copy; 2025 Ylsoo Inc. All rights reserved.<br>
            <a href="https://ylsoo.com/privacy" style="color:#0ea5e9;">Privacy</a> • 
            <a href="https://ylsoo.com/terms" style="color:#0ea5e9;">Terms</a> • 
            <a href="https://ylsoo.com/contact" style="color:#0ea5e9;">Support</a></p>
          </div>
        </div>
      </div>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ success: false, error: 'Failed to send verification code.' });
  }
});

// =======================
// ROADMAP PAGE
// =======================
app.get('/roadmap', async (req, res) => {
  try {
    const { data: roadmap, error } = await ylsooCore
      .from('roadmap_items')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    // Group roadmap items by status for layout
    const grouped = {
      planned: roadmap.filter(i => i.status === 'planned'),
      in_progress: roadmap.filter(i => i.status === 'in_progress'),
      shipped: roadmap.filter(i => i.status === 'shipped'),
    };

    res.render('roadmap', { user: req.session.user || null, grouped });
  } catch (err) {
    console.error('Error loading roadmap:', err.message);
    res.render('roadmap', { user: req.session.user || null, grouped: { planned: [], in_progress: [], shipped: [] } });
  }
});


// Change Password
app.post('/api/account/change-password', requireAuth, async (req, res) => {
  const { newPassword, code } = req.body;
  const userId = req.session.user.id;
  try {
    const { data, error } = await ylsooCore
      .from('password_reset_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();
    if (error || !data) throw new Error('Invalid or expired verification code.');
    await ylsooCore.from('password_reset_codes').update({ used: true }).eq('id', data.id);
    const { error: updateError } = await ylsooCore.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
    res.render('account-security', { user: req.session.user, message: 'Password changed successfully!', error: null });
  } catch (err) {
    res.render('account-security', { user: req.session.user, message: null, error: err.message });
  }
});

// =======================
// STATUS PAGE + HISTORY
// =======================
app.get('/status', async (req, res) => {
  const start = Date.now();
  let coreStatus = 'Unknown';
  try {
    const { error } = await ylsooCore.from('journey').select('count').limit(1);
    coreStatus = error ? 'Error' : 'Online';
  } catch {
    coreStatus = 'Offline';
  }
  const latency = Date.now() - start;
  const uptime = Math.floor((Date.now() - serverStart) / 1000);
  const memory = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const cpuLoad = os.loadavg()[0].toFixed(2);
  const apiStatus = latency < 300 ? 'Online' : 'Degraded';

  try {
    await ylsooCore.from('status_logs').insert([{
      api_status: apiStatus,
      latency_ms: latency,
      core_status: coreStatus,
      uptime_seconds: uptime,
      memory_mb: memory,
      cpu_load: cpuLoad
    }]);
  } catch (err) {
    console.error('Insert log error:', err.message);
  }

  let history = [];
  try {
    const { data } = await ylsooCore
      .from('status_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);
    history = (data || []).reverse();
  } catch (err) {
    console.error('Fetch logs error:', err.message);
  }

  res.render('status', {
    user: req.session.user || null,
    status: {
      api: apiStatus,
      latency,
      core: coreStatus,
      uptime,
      memory,
      cpu: cpuLoad,
      lastChecked: new Date().toLocaleTimeString()
    },
    history
  });
});

// =======================
// SUSTAINABILITY
// =======================
app.get('/sustainability', (req, res) => {
  res.render('sustainability', { user: req.session.user || null });
});
// =======================
// API STATUS (for external uptime monitors)
// =======================
app.get('/api/status', async (req, res) => {
  const start = Date.now();
  let core = 'Online';
  try {
    const { error } = await ylsooCore.from('journey').select('count').limit(1);
    if (error) core = 'Error';
  } catch {
    core = 'Offline';
  }

  const latency = Date.now() - start;
  const uptime = Math.floor((Date.now() - serverStart) / 1000);

  res.json({
    api: latency < 300 ? 'Online' : 'Degraded',
    latency,
    core,
    uptime,
    timestamp: new Date().toISOString(),
  });
});

// =======================
// EMAIL TEST ROUTE (for developers)
// =======================
app.get('/api/email/test', async (req, res) => {
  try {
    await resend.emails.send({
      from: 'Ylsoo Security <noreply@accts.ylsoo.com>',
      to: 'pexusspielt@gmail.com',
      subject: '✅ Ylsoo Email Test Successful',
      html: `
      <div style="font-family:Inter,Arial,sans-serif;background-color:#f9fafb;padding:0;margin:0;">
        <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(90deg,#0f172a,#1e293b);padding:24px;text-align:center;">
            <img src="https://ylsoo.com/logo.png" alt="Ylsoo Logo" style="max-width:150px;height:auto;" />
          </div>
          <div style="padding:32px 28px;text-align:center;">
            <h2 style="color:#111827;">Email Delivery Working 🚀</h2>
            <p style="font-size:15px;line-height:1.6;color:#374151;">
              This confirms your Resend email setup is working properly.<br>
              Emails will be sent from <b>noreply@accts.ylsoo.com</b>.
            </p>
            <p style="font-size:13px;color:#6b7280;">(You can safely delete this test message.)</p>
          </div>
          <div style="background:#f3f4f6;padding:20px;text-align:center;font-size:13px;color:#6b7280;">
            &copy; 2025 Ylsoo Inc.<br>
            <a href="https://ylsoo.com" style="color:#0284c7;text-decoration:none;">Visit Ylsoo</a>
          </div>
        </div>
      </div>`
    });

    res.json({ success: true, message: 'Test email sent successfully via Resend.' });
  } catch (err) {
    console.error('Email test error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send test email.' });
  }
});

// =======================
// 404 FALLBACK
// =======================
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user || null });
});

// =======================
// SERVER START
// =======================
app.listen(PORT, () => {
  console.log(`✅ Ylsoo server running on http://localhost:${PORT}`);
  console.log(`🔗 Connected to Ylsoo Core: ${ylsooCoreUrl}`);
});
