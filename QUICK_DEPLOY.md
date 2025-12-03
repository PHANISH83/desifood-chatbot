# 🚀 Quick Deploy Checklist

## 1️⃣ Push to GitHub (5 minutes)

```cmd
cd desifood-chatbot
git init
git add .
git commit -m "Initial commit"
```

Create repo at https://github.com/new then:
```cmd
git remote add origin https://github.com/YOUR_USERNAME/desifood-chatbot.git
git branch -M main
git push -u origin main
```

---

## 2️⃣ Deploy Backend to Render (5 minutes)

1. Go to https://render.com → Sign up with GitHub
2. Click **New +** → **Web Service**
3. Select your `desifood-chatbot` repo
4. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add Environment Variable:
   - `KB_ADMIN_KEY` = `your-secret-key-123`
6. Click **Create Web Service**
7. **Copy URL**: `https://desifood-backend-xxxx.onrender.com`

---

## 3️⃣ Update Frontend (2 minutes)

Edit `frontend/index.html` line 48:
```javascript
const API_URL = 'https://your-backend-url.onrender.com';
```

Push update:
```cmd
git add frontend/index.html
git commit -m "Add backend URL"
git push
```

---

## 4️⃣ Deploy Frontend to Vercel (3 minutes)

1. Go to https://vercel.com → Sign up with GitHub
2. Click **Add New** → **Project**
3. Import `desifood-chatbot` repo
4. Settings:
   - Root Directory: `frontend`
5. Click **Deploy**
6. **Copy URL**: `https://desifood-chatbot.vercel.app`

---

## 5️⃣ Update CORS (1 minute)

Go back to Render:
1. Your service → **Environment** tab
2. Add variable:
   - `ALLOWED_ORIGINS` = `https://your-vercel-url.vercel.app`
3. Save (auto-redeploys)

---

## ✅ Done! Share URL with Team

**Customer Chat URL:**
```
https://your-vercel-url.vercel.app
```

**Test it:**
- "What payment methods?"
- "Do I need to pay custom duty?"
- "Which brand is good for ghee?"

---

## 📝 Total Time: ~15 minutes
## 💰 Total Cost: $0 (Free tier)
