# DesiFood Chatbot - Complete Deployment Guide

## 🚀 Quick Deployment Steps

### Step 1: Push Code to GitHub

1. **Initialize Git** (if not already done):
```cmd
cd desifood-chatbot
git init
git add .
git commit -m "DesiFood chatbot ready for deployment"
```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Repository name: `desifood-chatbot`
   - Make it Public or Private
   - Click "Create repository"

3. **Push to GitHub**:
```cmd
git remote add origin https://github.com/YOUR_USERNAME/desifood-chatbot.git
git branch -M main
git push -u origin main
```

---

## 🔧 Step 2: Deploy Backend to Render

### 2.1 Create Render Account
- Go to https://render.com
- Sign up with GitHub (recommended)

### 2.2 Deploy Backend
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `desifood-chatbot`
3. Configure settings:

**Basic Settings:**
- **Name**: `desifood-backend` (or any name)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Environment Variables** (click "Add Environment Variable"):
```
KB_ADMIN_KEY = your-secret-admin-key-here
ALLOWED_ORIGINS = https://your-frontend-url.vercel.app
```
(You can add ALLOWED_ORIGINS later after deploying frontend)

**Plan:**
- Select **Free** plan (perfect for testing)

4. Click **"Create Web Service"**
5. Wait 3-5 minutes for deployment
6. **Copy your backend URL**: `https://desifood-backend.onrender.com`

### 2.3 Test Backend
Open in browser:
```
https://your-backend-url.onrender.com
```
You should see the chat interface!

Test API:
```
https://your-backend-url.onrender.com/api/answers
```

---

## 🌐 Step 3: Deploy Frontend to Vercel

### 3.1 Update Frontend with Backend URL
Before deploying, update the frontend to use your Render backend URL:

**Edit `frontend/index.html`** - Replace line:
```javascript
const API_URL = 'REPLACE_WITH_BACKEND_URL';
```
With:
```javascript
const API_URL = 'https://your-backend-url.onrender.com';
```

**Commit the change:**
```cmd
git add frontend/index.html
git commit -m "Update backend URL"
git push
```

### 3.2 Deploy to Vercel
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository: `desifood-chatbot`
5. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
6. Click **"Deploy"**
7. Wait 1-2 minutes
8. **Copy your frontend URL**: `https://desifood-chatbot.vercel.app`

### 3.3 Update CORS on Render
Go back to Render dashboard:
1. Open your backend service
2. Go to **Environment** tab
3. Update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS = https://your-frontend-url.vercel.app
```
4. Save (service will auto-redeploy)

---

## ✅ Step 4: Test Everything

### Test Frontend
Open: `https://your-frontend-url.vercel.app`

Try these questions:
- "What payment methods do you accept?"
- "Do I need to pay custom duty?"
- "Which brand is good for ghee?"
- "Is returns allowed?"
- "Where is my order ORD123?"

### Test Admin API
Add new Q&A using curl or Postman:
```bash
curl -X POST https://your-backend-url.onrender.com/api/kb/add \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-admin-key-here" \
  -d '{
    "questionTemplates": ["do you deliver to germany?"],
    "answerText": "Yes, we deliver to Germany! Shipping takes 7-10 days."
  }'
```

---

## 📱 Share with Your Team

**Frontend URL (for customers):**
```
https://your-frontend-url.vercel.app
```

**Backend API (for developers):**
```
https://your-backend-url.onrender.com/api/chat
```

**Admin Panel:**
Share the admin key securely with team members who need to add Q&A.

---

## 🔄 Making Updates

### Update Knowledge Base
1. Edit `backend/kb.json`
2. Commit and push:
```cmd
git add backend/kb.json
git commit -m "Update knowledge base"
git push
```
3. Render will auto-deploy (takes 2-3 minutes)

### Update Code
1. Make changes to `backend/server.js` or `frontend/index.html`
2. Commit and push
3. Both Render and Vercel will auto-deploy

---

## 🛠️ Troubleshooting

### Backend not responding
- Check Render logs: Dashboard → Your Service → Logs
- Verify environment variables are set
- Check if service is running (not sleeping)

### CORS errors
- Make sure `ALLOWED_ORIGINS` includes your Vercel URL
- Check browser console for exact error

### Frontend not connecting
- Verify `API_URL` in `frontend/index.html` is correct
- Check if backend URL is accessible
- Open browser DevTools → Network tab to see requests

---

## 💰 Cost

**Free Tier Limits:**
- **Render Free**: Backend sleeps after 15 min inactivity (wakes up in ~30 seconds)
- **Vercel Free**: Unlimited bandwidth, 100 GB/month

**Upgrade if needed:**
- Render Starter: $7/month (no sleep, better performance)
- Vercel Pro: $20/month (more bandwidth, better support)

---

## 🔐 Security Notes

1. **Never commit** `KB_ADMIN_KEY` to GitHub
2. Use strong admin key (20+ characters)
3. Enable CORS only for your frontend domain
4. For production, consider adding rate limiting

---

## 📞 Support

If you face issues:
1. Check Render logs
2. Check browser console
3. Test API endpoints directly
4. Verify environment variables

---

## 🎉 You're Done!

Your chatbot is now live and accessible worldwide. Share the Vercel URL with your team and customers!
