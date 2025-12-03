# DesiFood Chatbot - Setup Instructions

## Quick Start (Local Development)

### 1. Install Dependencies
```cmd
cd desifood-chatbot\backend
npm install
```

### 2. Run the Server
```cmd
set KB_ADMIN_KEY=mysecretkey
npm start
```

### 3. Test the Chatbot
Open browser: http://localhost:3000

Try these questions:
- "Can I pay using credit card?"
- "Which brand is good for ghee?"
- "Where is my order ORD123?"

## API Endpoints

### Chat
```cmd
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\":\"Can I pay using credit card?\"}"
```

### Get All Answers
```cmd
curl http://localhost:3000/api/answers
```

### Add New Q&A (Admin)
```cmd
curl -X POST http://localhost:3000/api/kb/add -H "Content-Type: application/json" -H "x-admin-key: mysecretkey" -d "{\"questionTemplates\":[\"do you accept visa?\"],\"answerText\":\"Yes, we accept Visa.\"}"
```

## Deploy to Render

1. Push code to GitHub
2. Go to https://dashboard.render.com
3. New -> Web Service
4. Connect your repo
5. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add Environment Variables:
   - `KB_ADMIN_KEY` = your-secret-key
   - `ALLOWED_ORIGINS` = your-frontend-url (optional)

## Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Import Project -> select repo
3. Root Directory: `frontend`
4. Replace `REPLACE_WITH_BACKEND_URL` in index.html with your Render URL
5. Deploy

## Features

- TF-IDF + Levenshtein + Token Overlap matching
- Order tracking intent detection
- Keyword fallback for deterministic answers
- Admin API for adding/importing Q&A
- Supabase support (optional)
- Local kb.json fallback
