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
const ylsooCoreKey = process.env.SUPABASE_ANON_KEY || 'YOUR_PUBLIC_KEY_HERE';
const ylsooCore = createClient(ylsooCoreUrl, ylsooCoreKey);

const ylsooServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const ylsooService = ylsooServiceKey
  ? createClient(ylsooCoreUrl, ylsooServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// =======================
// RESEND EMAIL SETUP
// =======================
const resend = new Resend(process.env.RESEND_API_KEY || 'YOUR_RESEND_KEY');

// =======================
// STRIPE SETUP
// =======================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

// =======================
// MIDDLEWARE
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ylsoo-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true if behind HTTPS proxy
  })
);

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
// CAREERS
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
    res.render('careers', { user: req.session.user || null, jobs: [] });
  }
});

// Single job
app.get('/careers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job, error } = await ylsooCore.from('careers').select('*').eq('id', id).single();

    if (error || !job) throw error;

    let requirementNote = 'General qualifications apply.';
    const loc = (job.location || '').toLowerCase();

    if (loc.includes('germany') || loc.includes('berlin')) {
      requirementNote = 'A university degree or equivalent professional experience is required in Germany.';
    } else if (loc.includes('usa') || loc.includes('america')) {
      requirementNote = 'Bachelor’s degree preferred; relevant experience accepted.';
    } else if (loc.includes('uk') || loc.includes('london')) {
      requirementNote = 'Applicants must have the right to work in the UK.';
    } else if (loc.includes('canada')) {
      requirementNote = 'Bachelor’s degree or experience preferred; bilingual a plus.';
    } else if (loc.includes('france') || loc.includes('paris')) {
      requirementNote = 'English + French fluency typically required.';
    } else if (loc.includes('remote')) {
      requirementNote = 'Requirements may vary depending on region.';
    }

    res.render('career-entry', {
      user: req.session.user || null,
      job,
      requirementNote,
    });
  } catch (err) {
    res.status(404).render('404', { user: req.session.user || null });
  }
});


// =======================
// TEAMS PAGE (CORE MEMBERS)
// =======================
app.get('/team', async (req, res) => {
  try {
    const { data: teams, error } = await ylsooCore
      .from('core_team_members')
      .select('*')
      .order('priority', { ascending: true })
      .order('joined_year', { ascending: false });

    if (error) throw error;

    res.render('teams', { user: req.session.user || null, teams });
  } catch (err) {
    console.error('Error loading core team members:', err.message);
    res.render('teams', { user: req.session.user || null, teams: [] });
  }
});

// =======================
// STATIC PAGES
// =======================
app.get('/terms', (req, res) => res.render('terms', { user: req.session.user || null }));
app.get('/privacy', (req, res) => res.render('privacy', { user: req.session.user || null }));
app.get('/cookies', (req, res) => res.render('cookies', { user: req.session.user || null }));
app.get('/about', (req, res) => res.render('about', { user: req.session.user || null }));
app.get('/contact', (req, res) => res.render('contact', { user: req.session.user || null }));
app.get('/no-hello', (req, res) => res.render('no-hello', { user: req.session.user || null }));

// =======================
// PARTNERS
// =======================
app.get('/partners', async (req, res) => {
  try {
    const { data: partners, error } = await ylsooCore.from('partners').select('*').order('id');

    if (error) throw error;

    res.render('partners', { user: req.session.user || null, partners });
  } catch {
    res.render('partners', { user: req.session.user || null, partners: [] });
  }
});

// =======================
// JOURNEY
// =======================
app.get('/journey', async (req, res) => {
  try {
    const { data: milestones, error } = await ylsooCore
      .from('journey')
      .select('*')
      .order('year', { ascending: true });

    if (error) throw error;

    res.render('journey', { user: req.session.user || null, milestones });
  } catch {
    res.render('journey', { user: req.session.user || null, milestones: [] });
  }
});

// =======================
// STORIES SYSTEM
// =======================
app.get('/stories', async (req, res) => {
  try {
    const { data: stories, error } = await ylsooCore.from('stories').select('*').order('id');

    if (error) throw error;

    res.render('stories', { user: req.session.user || null, stories });
  } catch {
    res.render('stories', { user: req.session.user || null, stories: [] });
  }
});

app.get('/story/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: story, error } = await ylsooCore
      .from('stories')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !story) throw error;
    res.render('story', { user: req.session.user || null, story });
  } catch {
    res.status(404).render('404', { user: req.session.user || null });
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
// STRIPE SETUP INTENT
// =======================
app.post('/api/create-setup-intent', requireAuth, async (req, res) => {
  try {
    let customerId = req.session.user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.session.user.email,
        name: req.session.user.name || 'Ylsoo User',
      });

      customerId = customer.id;
      req.session.user.stripe_customer_id = customerId;

      await ylsooCore.from('users').update({ stripe_customer_id: customerId }).eq('id', req.session.user.id);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

// =======================
// SAVE PAYMENT METHOD
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
    res.status(500).json({ error: err.message });
  }
});

// =======================
// OPTIONAL 1¢ VERIFY CHARGE
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
      amount: 1,
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
    res.status(500).json({ error: err.message });
  }
});

// =======================
// SIGNUP / LOGIN / LOGOUT
// =======================
app.post('/api/signup', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const { data, error } = await ylsooCore.auth.signUp({
      email,
      password,
      options: { data: { name } },
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
      name: data.user.user_metadata?.name || email.split('@')[0],
    };
    req.session.user = user;

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    await ylsooCore.from('user_sessions').insert({
      user_id: user.id,
      device_name: userAgent.substring(0, 80),
      browser: userAgent,
      os: userAgent.includes('Mac') ? 'macOS' : userAgent.includes('Win') ? 'Windows' : 'Unknown',
      ip_address: ip,
    });

    res.json({ success: true, redirect: '/dashboard' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, redirect: '/' });
  });
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
  } catch {
    res.render('labs', { user: req.session.user || null, labs: [] });
  }
});

// =======================
// BLOG
// =======================
app.get('/blog', async (req, res) => {
  try {
    const { data: posts, error } = await ylsooCore
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.render('blog', { user: req.session.user || null, posts });
  } catch {
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

    if (error || !post) throw error;

    res.render('blog-post', { user: req.session.user || null, post });
  } catch {
    res.status(404).render('404', { user: req.session.user || null });
  }
});

// =======================
// ETHICAL AI
// =======================
app.get('/ethical-ai', async (req, res) => {
  try {
    const { data: pillars, error: pillarsError } = await ylsooCore
      .from('ethical_pillars')
      .select('*')
      .order('order_index');

    if (pillarsError) throw pillarsError;

    const { data: principles, error: principlesError } = await ylsooCore
      .from('ethical_principles')
      .select('*')
      .order('order_index');

    if (principlesError) throw principlesError;

    res.render('ethical-ai', {
      user: req.session.user || null,
      pillars,
      principles,
    });
  } catch (err) {
    res.render('ethical-ai', {
      user: req.session.user || null,
      pillars: [],
      principles: [],
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
  } catch {
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
// ACCOUNT NOTIFICATIONS PAGE
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
      preferences:
        preferences || {
          email_updates: true,
          marketing_emails: false,
          security_alerts: true,
          product_announcements: true,
        },
    });
  } catch {
    res.render('account-notifications', {
      user: req.session.user,
      preferences: {
        email_updates: true,
        marketing_emails: false,
        security_alerts: true,
        product_announcements: true,
      },
    });
  }
});

app.post('/api/account/notifications', requireAuth, async (req, res) => {
  const { email_updates, marketing_emails, security_alerts, product_announcements } = req.body;

  try {
    const { error } = await ylsooCore.from('notification_preferences').upsert({
      user_id: req.session.user.id,
      email_updates: email_updates === 'on',
      marketing_emails: marketing_emails === 'on',
      security_alerts: security_alerts === 'on',
      product_announcements: product_announcements === 'on',
    });

    if (error) throw error;

    res.redirect('/account/notifications');
  } catch (err) {
    res.status(500).send('Error saving preferences');
  }
});

// =======================
// NOTIFICATIONS
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
  } catch {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// CHANGELOG
// =======================
app.get('/changelog', async (req, res) => {
  try {
    const { data: changelogs, error } = await ylsooCore
      .from('changelog_entries')
      .select('*')
      .order('release_date', { ascending: false });

    if (error) throw error;

    res.render('changelog', { user: req.session.user || null, changelogs });
  } catch {
    res.render('changelog', { user: req.session.user || null, changelogs: [] });
  }
});

app.get('/changes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: entry, error } = await ylsooCore
      .from('changelog_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !entry) throw error;

    res.render('changelog-entry', { user: req.session.user || null, entry });
  } catch {
    res.status(404).render('404', { user: req.session.user || null });
  }
});

// =======================
// ACCOUNT SECURITY (GET)
// =======================
app.get('/account/security', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const flashMessage = req.query.message || null;
  const flashError = req.query.error || null;

  try {
    // Default profile from session
    let profile = {
      full_name: req.session.user.name || '',
      job_title: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      phone_number: '',
      recovery_email: '',
    };

    // Load metadata via service key if available
    if (ylsooService?.auth?.admin?.getUserById) {
      try {
        const { data: adminUser, error: adminError } = await ylsooService.auth.admin.getUserById(
          userId
        );
        if (adminError) throw adminError;
        const metadata = adminUser?.user?.user_metadata || {};
        profile = {
          full_name: metadata.name || metadata.full_name || req.session.user.name || '',
          job_title: metadata.job_title || '',
          timezone:
            metadata.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          phone_number: metadata.phone_number || '',
          recovery_email: metadata.recovery_email || '',
        };
      } catch (adminErr) {
        console.warn('Profile metadata fallback used:', adminErr.message);
      }
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY missing; using session profile defaults.');
    }

    // Recent sessions
    let recentSessions = [];
    const { data: sessionRows, error: sessionsError } = await ylsooCore
      .from('user_sessions')
      .select('id, device_name, browser, os, ip_address, created_at, last_active, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessionsError && sessionsError.code !== 'PGRST116') throw sessionsError;
    if (sessionRows) {
      recentSessions = sessionRows;
    }

    // Notification preferences
    const { data: prefs, error: prefsError } = await ylsooCore
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') throw prefsError;

    res.render('account-security', {
      user: req.session.user,
      profile,
      sessions: recentSessions || [],
      preferences:
        prefs || {
          email_updates: true,
          marketing_emails: false,
          security_alerts: true,
          product_announcements: true,
        },
      message: flashMessage,
      error: flashError,
    });
  } catch (err) {
    console.error('Account security load error:', err.message);

    res.render('account-security', {
      user: req.session.user,
      profile: {
        full_name: req.session.user.name || '',
        job_title: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        phone_number: '',
        recovery_email: '',
      },
      sessions: [],
      preferences: {
        email_updates: true,
        marketing_emails: false,
        security_alerts: true,
        product_announcements: true,
      },
      message: flashMessage,
      error: flashError || 'Unable to load account data.',
    });
  }
});

// =======================
// CHANGE EMAIL
// =======================
app.post('/api/account/change-email', requireAuth, async (req, res) => {
  const { newEmail } = req.body;
  try {
    const { error } = await ylsooCore.auth.updateUser({ email: newEmail });
    if (error) throw error;

    req.session.user.email = newEmail;
    res.redirect(
      '/account/security?message=' + encodeURIComponent('Email updated successfully!')
    );
  } catch (err) {
    res.redirect('/account/security?error=' + encodeURIComponent(err.message));
  }
});

// =======================
// UPDATE PROFILE METADATA
// =======================
app.post('/api/account/profile', requireAuth, async (req, res) => {
  const { full_name, job_title, timezone, phone_number, recovery_email } = req.body;

  try {
    const metadata = {
      name: full_name || req.session.user.name,
      job_title: job_title || '',
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      phone_number: phone_number || '',
      recovery_email: recovery_email || '',
    };

    if (ylsooService?.auth?.admin?.updateUserById) {
      const { error } = await ylsooService.auth.admin.updateUserById(
        req.session.user.id,
        { user_metadata: metadata }
      );
      if (error) throw error;
    } else {
      const { error } = await ylsooCore.auth.updateUser({ data: metadata });
      if (error) throw error;
    }

    req.session.user.name = metadata.name;
    res.redirect(
      '/account/security?message=' +
        encodeURIComponent('Profile updated successfully.')
    );
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.redirect(
      '/account/security?error=' + encodeURIComponent('Failed to update profile.')
    );
  }
});

// =======================
// PASSWORD RESET EMAIL
// =======================
app.post('/api/account/request-password-code', requireAuth, async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const userId = req.session.user.id;
  const email = req.session.user.email;
  const name = req.session.user.name || 'User';

  try {
    await ylsooCore.from('password_reset_codes').insert([
      {
        user_id: userId,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        used: false,
      },
    ]);

    await resend.emails.send({
      from: 'Ylsoo Security <noreply@accts.ylsoo.com>',
      to: email,
      subject: 'Your Ylsoo Security Code',
      html: `<p>Hi ${name},</p><p>Your verification code is: <b>${code}</b></p>`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send code.' });
  }
});

// =======================
// CHANGE PASSWORD
// =======================
app.post('/api/account/change-password', requireAuth, async (req, res) => {
  const { newPassword, code } = req.body;

  try {
    const { data, error } = await ylsooCore
      .from('password_reset_codes')
      .select('*')
      .eq('user_id', req.session.user.id)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !data) throw new Error('Invalid or expired verification code.');

    await ylsooCore
      .from('password_reset_codes')
      .update({ used: true })
      .eq('id', data.id);

    const { error: updateError } = await ylsooCore.auth.updateUser({
      password: newPassword,
    });
    if (updateError) throw updateError;

    res.redirect(
      '/account/security?message=' +
        encodeURIComponent('Password changed successfully!')
    );
  } catch (err) {
    res.redirect('/account/security?error=' + encodeURIComponent(err.message));
  }
});

// =======================
// TOGGLE SECURITY ALERTS
// =======================
app.post('/api/account/security-alerts', requireAuth, async (req, res) => {
  const enabled =
    req.body.enabled === true ||
    req.body.enabled === 'true' ||
    req.body.enabled === 'on';

  try {
    const { data: existing, error: fetchError } = await ylsooCore
      .from('notification_preferences')
      .select('*')
      .eq('user_id', req.session.user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    const payload = {
      user_id: req.session.user.id,
      email_updates: existing?.email_updates ?? true,
      marketing_emails: existing?.marketing_emails ?? false,
      product_announcements: existing?.product_announcements ?? true,
      security_alerts: enabled,
    };

    const { error } = await ylsooCore
      .from('notification_preferences')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Security alerts toggle error:', err.message);
    res
      .status(500)
      .json({ success: false, error: 'Unable to update security alerts.' });
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
      .order('id');

    if (error) throw error;

    const grouped = {
      planned: roadmap.filter((r) => r.status === 'planned'),
      in_progress: roadmap.filter((r) => r.status === 'in_progress'),
      shipped: roadmap.filter((r) => r.status === 'shipped'),
    };

    res.render('roadmap', { user: req.session.user || null, grouped });
  } catch {
    res.render('roadmap', {
      user: req.session.user || null,
      grouped: { planned: [], in_progress: [], shipped: [] },
    });
  }
});

// =======================
// STATUS PAGE
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
    await ylsooCore.from('status_logs').insert([
      {
        api_status: apiStatus,
        latency_ms: latency,
        core_status: coreStatus,
        uptime_seconds: uptime,
        memory_mb: memory,
        cpu_load: cpuLoad,
      },
    ]);
  } catch {}

  let history = [];

  try {
    const { data } = await ylsooCore
      .from('status_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    history = (data || []).reverse();
  } catch {}

  res.render('status', {
    user: req.session.user || null,
    status: {
      api: apiStatus,
      latency,
      core: coreStatus,
      uptime,
      memory,
      cpu: cpuLoad,
      lastChecked: new Date().toLocaleTimeString(),
    },
    history,
  });
});

// =======================
// API STATUS
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
// EMAIL TEST
// =======================
app.get('/api/email/test', async (req, res) => {
  try {
    await resend.emails.send({
      from: 'Ylsoo Security <noreply@accts.ylsoo.com>',
      to: 'pexusspielt@gmail.com',
      subject: 'Ylsoo Email Test',
      html: '<p>Email system is working.</p>',
    });

    res.json({ success: true, message: 'Test email sent successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send test email.' });
  }
});

// =======================
// SUSTAINABILITY
// =======================
app.get('/sustainability', (req, res) => {
  res.render('sustainability', { user: req.session.user || null });
});

// =======================
// ERROR HANDLERS
// =======================
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user || null });
});

app.use((err, req, res, next) => {
  console.error('💥 Internal Server Error:', err.stack);
  res.status(500).render('error', {
    user: req.session.user || null,
    message: 'Something went wrong.',
    error: err,
  });
});

// =======================
// SERVER START
// =======================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Connected to Supabase: ${ylsooCoreUrl}`);
});
