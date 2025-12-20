// server.js - ready to run
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const natural = require('natural');
const leven = require('leven');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // service role key recommended
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
const KB_ADMIN_KEY = process.env.KB_ADMIN_KEY || ''; // protect add/import

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: function(origin, cb){
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'));
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// normalization & tokenization
function normalize(s){ if(!s) return ''; return s.toString().toLowerCase().replace(/[^a-z0-9\s']/g,' ').replace(/\s+/g,' ').trim(); }
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
function tokens(s){ return tokenizer.tokenize(s).map(t=>stemmer.stem(t)); }

// in-memory KB + index
let KB = [];     // {id, templates[], answer}
let docs = [];   // {id, text}
let tfidf = null;
const TfIdf = natural.TfIdf;

// build index
function buildIndex(){
  docs = [];
  KB.forEach(entry=>{
    if (Array.isArray(entry.templates)) entry.templates.forEach(t=>docs.push({id:entry.id, text: normalize(t)}));
    if (entry.answer && entry.answer.length>3) docs.push({id:entry.id, text: normalize(entry.answer)});
  });
  tfidf = new TfIdf();
  docs.forEach(d=>tfidf.addDocument(d.text));
  console.log('[KB] index rebuilt, docs=', docs.length);
}

// load from supabase or local kb.json
const KB_PATH = path.join(__dirname,'kb.json');
async function loadKBFromStorage(){
  if (!supabase) {
    try { return JSON.parse(fs.readFileSync(KB_PATH,'utf8')); } catch(e){ return []; }
  }
  const { data, error } = await supabase.from('kb').select('id, templates, answer');
  if (error) { console.error('[Supabase] load error', error); return []; }
  return data.map(r => ({ id: r.id, templates: r.templates || [], answer: r.answer || '' }));
}

// upsert single entry
async function upsertEntry(entry){
  if (!supabase) {
    try {
      let arr = [];
      try { arr = JSON.parse(fs.readFileSync(KB_PATH,'utf8')); } catch(e){ arr = []; }
      const idx = arr.findIndex(x=>x.id===entry.id);
      if (idx>=0) arr[idx]=entry; else arr.push(entry);
      fs.writeFileSync(KB_PATH, JSON.stringify(arr, null, 2), 'utf8');
    } catch(e){ console.error('local save err', e); }
    return;
  }
  const { error } = await supabase.from('kb').upsert([{ id: entry.id, templates: entry.templates, answer: entry.answer }], { onConflict: ['id'] });
  if (error) console.error('[Supabase] upsert error', error);
}

// initial load & index
(async ()=>{
  KB = await loadKBFromStorage();
  buildIndex();
})();

// matching functions
function tfidfScores(query) {
  if (!tfidf) return [];
  const scores = [];
  tfidf.tfidfs(query, function(i, measure) {
    scores[i] = measure || 0;
  });
  for (let i = 0; i < docs.length; i++) if (!scores[i]) scores[i] = 0;
  return scores;
}
function tokenOverlapScore(qTokens, docTokens) {
  if (!qTokens || qTokens.length === 0) return 0;
  const setDoc = new Set(docTokens);
  let overlap = 0;
  qTokens.forEach(t => { if (setDoc.has(t)) overlap++; });
  return overlap / Math.max(qTokens.length, 1);
}
function levenshteinSim(a, b) {
  if (!a || !b) return 0;
  const d = leven(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - (d / maxLen);
}
function findBestMatch(query) {
  const q = normalize(query);
  const qTokens = tokens(q);
  const docTokensList = docs.map(d => tokens(d.text));
  const tfScores = tfidfScores(q);
  const maxTf = Math.max(...tfScores, 1);
  const tfNorm = tfScores.map(s => s / maxTf);
  
  let best = { idx: -1, combined: 0, components: {}, docId: null, docText: null };
  
  for (let i = 0; i < docs.length; i++) {
    const docText = docs[i].text;
    const docTokens = docTokensList[i];
    
    const tf = tfNorm[i];
    const lev = levenshteinSim(q, docText);
    const overlap = tokenOverlapScore(qTokens, docTokens);
    
    // weights: TF-IDF 0.55, overlap 0.25, lev 0.20
    const combined = (0.55 * tf) + (0.25 * overlap) + (0.20 * lev);
    
    if (combined > best.combined) {
      best = { idx: i, combined, components: { tf, overlap, lev }, docId: docs[i].id, docText };
    }
  }
  return best;
}

// order intent detection
function detectOrderIntent(q) {
  const normalized = normalize(q);
  const orderWords = /\b(order|track|tracking|where\sis|where's|dispatched|delivered|shipped|shipment)\b/;
  if (!orderWords.test(normalized)) return null;
  const idMatch = normalized.match(/\b(ord[\-]?\d+|ord\s*\d+)\b/i);
  const extracted = idMatch ? idMatch[0].toUpperCase().replace(/\s+/g, '') : null;
  return { extracted };
}

// Comprehensive intent detection for Indian food delivery
const intentKeywords = {
  payment: ['pay', 'payment', 'card', 'credit', 'debit', 'upi', 'cod', 'cash', 'paypal', 'netbank'],
  shipping: ['ship', 'delivery', 'deliver', 'arrive', 'days', 'time', 'long', 'fast', 'when'],
  shipping_cost: ['shipping cost', 'delivery fee', 'delivery charge', 'shipping charge', 'free shipping'],
  customs: ['custom', 'duty', 'import', 'tax', 'customs fee'],
  return: ['return', 'refund', 'exchange', 'money back'],
  defective: ['defective', 'damaged', 'broken', 'expired', 'quality issue', 'bad quality'],
  tracking: ['track', 'where is', 'order status', 'tracking number'],
  cancel: ['cancel', 'stop order'],
  availability: ['available', 'stock', 'out of stock', 'have this'],
  bulk: ['bulk', 'wholesale', 'large quantity', 'business order'],
  countries: ['which countries', 'ship to', 'deliver to', 'international'],
  expiry: ['expiry', 'expire', 'shelf life', 'fresh', 'expiration'],
  packaging: ['packaging', 'pack', 'break', 'secure', 'safe delivery'],
  minimum: ['minimum order', 'minimum purchase', 'small order'],
  support: ['contact', 'support', 'help', 'customer service', 'email', 'phone'],
  account: ['account', 'sign up', 'register', 'guest checkout'],
  discount: ['discount', 'coupon', 'promo', 'offer', 'sale', 'deal'],
  organic: ['organic', 'chemical free', 'natural'],
  halal: ['halal', 'muslim', 'islamic'],
  vegan: ['vegan', 'plant based', 'no dairy'],
  gluten: ['gluten free', 'celiac', 'no wheat'],
  
  // Product categories
  ghee: ['ghee', 'clarified butter'],
  rice: ['rice', 'basmati', 'biryani'],
  atta: ['atta', 'flour', 'wheat flour'],
  dal: ['dal', 'pulses', 'lentils'],
  oil: ['oil', 'cooking oil'],
  spices: ['spice', 'masala', 'spices'],
  tea: ['tea', 'chai'],
  snacks: ['snack', 'namkeen', 'snacks'],
  pickle: ['pickle', 'achar', 'pickles'],
  
  // Intent modifiers
  recommend: ['good', 'best', 'recommend', 'should', 'buy', 'top', 'which', 'suggest']
};

function detectIntent(query) {
  const q = normalize(query);
  
  // PRIORITY ORDER: Check specific intents first to avoid false matches
  // Most specific patterns first, generic patterns last
  
  // 0. Greetings and conversational (check first for quick response)
  if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening)$/)) {
    return 'greeting';
  }
  if (q.match(/^(thank you|thanks|thx|appreciate)$/)) {
    return 'thanks';
  }
  if (q.match(/^(bye|goodbye|see you|see ya)$/)) {
    return 'bye';
  }
  if (q.match(/how are you|how r u|whats up|what's up|how's it going/)) {
    return 'how_are_you';
  }
  if (q.match(/who are you|what are you|what is this|what can you do|^help$/)) {
    return 'who_are_you';
  }
  
  // 1. Order tracking (very specific)
  if (q.match(/track|where is my order|order status|tracking number|check order/)) {
    return 'tracking';
  }
  
  // 2. Cancel order (specific action)
  if (q.match(/cancel|stop order|cancel my order/)) {
    return 'cancel';
  }
  
  // 3. Defective/damaged products (specific issue)
  if (q.match(/defective|damaged|broken|expired|quality issue|bad quality|received damaged/)) {
    return 'defective';
  }
  
  // 4. Returns/refunds (specific policy)
  if (q.match(/return|refund|exchange|money back|return policy|returns allowed/)) {
    return 'return';
  }
  
  // 5. Custom duty (before "pay" keyword)
  if (q.match(/custom|duty|import tax|customs fee|customs charge/)) {
    return 'customs';
  }
  
  // 6. Shipping cost (before general shipping)
  if (q.match(/shipping cost|delivery fee|delivery charge|shipping charge|free shipping|how much.*ship|how much.*deliver/)) {
    return 'shipping_cost';
  }
  
  // 7. Shipping time/duration
  if (q.match(/how long|when will.*arrive|delivery time|shipping.*take|how many days|how fast/)) {
    return 'shipping';
  }
  
  // 8. Countries/locations (check BEFORE general shipping)
  if (q.match(/america|usa|united states|us\b/)) {
    if (q.match(/ship|deliver|available|get.*product|send/)) {
      return 'ship_to_usa';
    }
  }
  if (q.match(/canada|uk|united kingdom|australia|germany|singapore|uae|dubai/)) {
    if (q.match(/ship|deliver|available|get.*product|send/)) {
      return 'ship_to_country';
    }
  }
  if (q.match(/which countries|ship to|deliver to|international|do you ship|shipping locations/)) {
    return 'countries';
  }
  
  // 9. Product expiry/freshness
  if (q.match(/expiry|expire|shelf life|fresh|expiration|how long.*last/)) {
    return 'expiry';
  }
  
  // 10. Packaging quality
  if (q.match(/packaging|pack|will.*break|secure|safe delivery|how.*packed/)) {
    return 'packaging';
  }
  
  // 11. Product availability/stock
  if (q.match(/available|stock|out of stock|have this|do you have|in stock/)) {
    return 'availability';
  }
  
  // 12. Bulk/wholesale orders
  if (q.match(/bulk|wholesale|large quantity|business order|order.*bulk/)) {
    return 'bulk';
  }
  
  // 13. Minimum order
  if (q.match(/minimum order|minimum purchase|small order|minimum.*value/)) {
    return 'minimum';
  }
  
  // 14. Discount/coupons/offers
  if (q.match(/discount|coupon|promo|offer|sale|deal|code/)) {
    return 'discount';
  }
  
  // 15. Customer support/contact
  if (q.match(/contact|support|help|customer service|email|phone|talk to|reach you/)) {
    return 'support';
  }
  
  // 16. Account creation
  if (q.match(/account|sign up|register|guest checkout|create account|need.*account/)) {
    return 'account';
  }
  
  // 17. Dietary preferences (specific before generic product questions)
  if (q.match(/organic|chemical free|natural|organic products/)) {
    return 'organic';
  }
  if (q.match(/halal|muslim|islamic|halal certified/)) {
    return 'halal';
  }
  if (q.match(/vegan|plant based|no dairy|vegan products/)) {
    return 'vegan';
  }
  if (q.match(/gluten free|celiac|no wheat|gluten free products/)) {
    return 'gluten';
  }
  
  // 18. Product brand recommendations (check product type + recommendation intent)
  // Check for BAD/AVOID questions first
  if (q.match(/ghee/) && q.match(/bad|worst|avoid|poor|terrible|not good|should.*avoid/)) {
    return 'ghee_bad';
  }
  if (q.match(/ghee/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'ghee';
  }
  // Check bad brands for other products
  if (q.match(/rice|basmati/) && q.match(/bad|worst|avoid|poor|terrible|not good|should.*avoid/)) {
    return 'rice_bad';
  }
  if (q.match(/rice|basmati/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'rice';
  }
  
  if (q.match(/atta|flour|wheat/) && q.match(/bad|worst|avoid|poor|terrible|not good|should.*avoid/)) {
    return 'atta_bad';
  }
  if (q.match(/atta|flour|wheat/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'atta';
  }
  
  if (q.match(/dal|pulses|lentils/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'dal';
  }
  if (q.match(/oil|cooking oil/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'oil';
  }
  if (q.match(/spice|masala/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'spices';
  }
  if (q.match(/tea|chai/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'tea';
  }
  if (q.match(/snack|namkeen/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'snacks';
  }
  if (q.match(/pickle|achar/) && q.match(/good|best|recommend|which|top|should.*buy|suggest/)) {
    return 'pickle';
  }
  
  // 19. Payment methods (generic, check last)
  if (q.match(/pay|payment|card|credit|debit|upi|cod|cash|paypal|netbank/)) {
    return 'payment';
  }
  
  // 20. General shipping (most generic)
  if (q.match(/ship|delivery|deliver/)) {
    return 'shipping';
  }
  
  return null;
}

function keywordFallback(query) {
  const intent = detectIntent(query);
  
  if (!intent) return null;
  
  // Direct intent to KB ID mapping
  const intentToKbId = {
    // Conversational
    greeting: 'greeting',
    thanks: 'thanks',
    bye: 'bye',
    how_are_you: 'how_are_you',
    who_are_you: 'who_are_you',
    
    // Customer service
    payment: 'payment_methods',
    shipping: 'shipping_time',
    shipping_cost: 'shipping_cost',
    customs: 'custom_duty',
    return: 'return_policy',
    defective: 'defective_product',
    tracking: 'order_tracking',
    cancel: 'cancel_order',
    
    // Product & order info
    availability: 'product_availability',
    bulk: 'bulk_order',
    countries: 'countries_shipping',
    ship_to_usa: 'ship_to_usa',
    ship_to_country: 'ship_to_country',
    expiry: 'product_expiry',
    packaging: 'packaging_quality',
    minimum: 'minimum_order',
    
    // Account & offers
    support: 'customer_support',
    account: 'account_creation',
    discount: 'discount_coupons',
    
    // Dietary preferences
    organic: 'organic_products',
    halal: 'halal_products',
    vegan: 'vegan_products',
    gluten: 'gluten_free',
    
    // Product recommendations
    ghee: 'ghee_brand_good',
    ghee_bad: 'ghee_brand_bad',
    rice: 'rice_brand_good',
    rice_bad: 'rice_brand_bad',
    atta: 'atta_brand_good',
    atta_bad: 'atta_brand_bad',
    dal: 'dal_brand_good',
    oil: 'oil_brand_good',
    spices: 'spices_brand_good',
    tea: 'tea_brand_good',
    snacks: 'snacks_brand_good',
    pickle: 'pickle_brand_good'
  };
  
  const kbId = intentToKbId[intent];
  if (kbId) {
    return KB.find(a => a.id === kbId);
  }
  
  return null;
}

// endpoints
app.post('/api/chat', async (req, res) => {
  const { message, conversationHistory } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  
  const q = normalize(message);
  
  // 0) Check for negative intent first
  if (q.match(/\b(don't|dont|not|no|never)\b/) && q.match(/want|need|interested|like/)) {
    return res.json({ 
      reply: "No problem! Let me know if you need help with anything else. I can assist with shipping, payments, returns, or product recommendations." 
    });
  }
  
  // 1) Order intent
  const orderInfo = detectOrderIntent(message);
  if (orderInfo) {
    const extracted = orderInfo.extracted;
    if (extracted) {
      return res.json({
        reply: `Order ${extracted} is currently: Demo status (replace with real lookup).`
      });
    } else {
      return res.json({ reply: "Please provide your order id (e.g., ORD123) so I can check tracking." });
    }
  }
  
  // 2) Price questions
  if (q.match(/price|cost|how much|expensive|cheap/) && q.match(/ghee|rice|atta|dal|oil|spice|tea|product/)) {
    const product = q.match(/ghee/) ? 'ghee' : q.match(/rice/) ? 'rice' : q.match(/atta/) ? 'atta' : 'products';
    return res.json({
      reply: `Prices vary by brand and quantity. Please visit our website or app to see current prices for ${product}. We offer competitive pricing and regular discounts!`
    });
  }
  
  // 3) Quantity/weight questions
  if (q.match(/how much|how many|quantity|kg|kilogram|gram|liter/) && q.match(/order|buy|purchase/)) {
    return res.json({
      reply: "You can order any quantity from 100g to 50kg per item. For bulk orders above 50kg, contact wholesale@desifood.com for special pricing."
    });
  }
  
  // 4) Delivery date calculation
  if (q.match(/when.*arrive|delivery date|get.*order|receive.*order/) && q.match(/today|tomorrow|order today/)) {
    const today = new Date();
    const minDays = 7;
    const maxDays = 14;
    const minDate = new Date(today.getTime() + minDays * 24 * 60 * 60 * 1000);
    const maxDate = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return res.json({
      reply: `If you order today, your package should arrive between ${formatDate(minDate)} and ${formatDate(maxDate)} (7-14 business days). Express shipping available for 3-5 days delivery!`
    });
  }
  
  // 5) Brand comparison questions
  if (q.match(/better|compare|difference|vs|versus/) && q.match(/amul|nandini|india gate|daawat|aashirvaad|pillsbury/)) {
    return res.json({
      reply: "Both brands are excellent! The choice depends on your preference:\n• Amul/India Gate/Aashirvaad - Most popular, widely available, consistent quality\n• Nandini/Daawat/Pillsbury - Great quality, slightly different taste profile\n\nBoth are trusted brands. Try both and see which you prefer!"
    });
  }
  
  // 6) Multiple questions detection (split by "and", "also", "plus")
  if (q.match(/\band\b.*\?|\balso\b.*\?/) || (message.match(/\?/g) || []).length > 1) {
    // Split into parts and answer first question, suggest asking others separately
    return res.json({
      reply: "I see you have multiple questions! Let me help you one at a time for better answers. Please ask your first question, then I'll answer the next one. 😊"
    });
  }
  
  // 7) deterministic keyword fallback
  const direct = keywordFallback(message);
  if (direct) {
    return res.json({ reply: direct.answer, matched: direct.id });
  }
  
  // 8) TF-IDF + combined scorer
  const match = findBestMatch(message);
  const THRESH = 0.44;
  if (match && match.combined >= THRESH) {
    const entry = KB.find(a => a.id === match.docId);
    if (entry) {
      return res.json({
        reply: entry.answer,
        debug: {
          score: Number(match.combined.toFixed(3)),
          components: match.components,
          matchedTemplate: match.docText
        }
      });
    }
  }
  
  // fallback with conversation memory hint
  const fallbackMessages = [
    "I'm not sure about that yet. Try asking: 'What payment methods?', 'Best ghee brand?', 'Shipping time?', or 'Return policy?'",
    "Hmm, I don't have that info right now. You can ask me about products, shipping, payments, or returns!",
    "I'm still learning! Ask me about: payment methods, product brands, shipping details, or order tracking.",
    "Sorry, I couldn't find an answer. Try: 'Which brand is good for rice?', 'Do I need to pay custom duty?', or 'How to contact support?'"
  ];
  const randomFallback = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
  res.json({ reply: randomFallback });
});

// KB endpoints protected by KB_ADMIN_KEY header
function checkAdminKey(req, res) {
  const key = req.headers['x-admin-key'] || '';
  if (!KB_ADMIN_KEY || KB_ADMIN_KEY === '') {
    return false;
  }
  return key === KB_ADMIN_KEY;
}

app.post('/api/kb/add', async (req, res) => {
  if (!checkAdminKey(req, res)) return res.status(401).json({ error: 'unauthorized: missing or invalid x-admin-key header' });
  const { id, questionTemplates, answerText } = req.body;
  if (!answerText) return res.status(400).json({ error: 'answerText required' });
  const newId = id || ('kb_' + Date.now());
  const entry = { id: newId, templates: Array.isArray(questionTemplates) ? questionTemplates : [], answer: answerText };
  KB.push(entry);
  await upsertEntry(entry);
  buildIndex();
  res.json({ ok: true, added: entry });
});

app.post('/api/kb/import', async (req, res) => {
  if (!checkAdminKey(req, res)) return res.status(401).json({ error: 'unauthorized: missing or invalid x-admin-key header' });
  const arr = req.body;
  if (!Array.isArray(arr)) return res.status(400).json({ error: 'expected array of Q&A' });
  KB = arr.map((a, i) => ({ id: a.id || ('kb_' + (Date.now() + i)), templates: a.templates || [], answer: a.answer || '' }));
  for (const e of KB) await upsertEntry(e);
  buildIndex();
  res.json({ ok: true, count: KB.length });
});

app.get('/api/answers', (req, res) => {
  res.json(KB.map(a => ({ id: a.id, sampleQuestions: (a.templates || []).slice(0, 3), answer: a.answer })));
});

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
