# DesiFood Chatbot 🍛

AI-powered chatbot for Indian food products delivery company serving customers abroad.

## Features

✅ **30+ Intents** - Handles all customer queries intelligently
✅ **Smart NLP** - TF-IDF + Levenshtein + Token Overlap matching
✅ **Brand Recommendations** - Ghee, Rice, Atta, Dal, Oil, Spices, Tea, Snacks, Pickles
✅ **Order Management** - Tracking, cancellation, returns, defective products
✅ **Shipping Info** - Time, cost, countries, customs, packaging
✅ **Admin API** - Add/import Q&A dynamically
✅ **No Custom Duty** - Clear messaging for international customers
✅ **Dietary Options** - Organic, Halal, Vegan, Gluten-free products

## Quick Start (Local)

```bash
cd desifood-chatbot/backend
npm install
set KB_ADMIN_KEY=mysecretkey
npm start
```

Open: http://localhost:3000

## Deployment

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for complete instructions.

**Quick Deploy:**
1. Push to GitHub
2. Deploy backend to Render (free)
3. Deploy frontend to Vercel (free)
4. Share URL with team!

## Project Structure

```
desifood-chatbot/
├── backend/
│   ├── server.js          # Main chatbot server
│   ├── kb.json            # Knowledge base (30+ Q&A)
│   ├── package.json       # Dependencies
│   └── public/
│       └── index.html     # Demo chat UI
├── frontend/
│   └── index.html         # Production frontend
├── DEPLOYMENT_GUIDE.md    # Step-by-step deployment
└── README.md              # This file
```

## API Endpoints

### Chat
```bash
POST /api/chat
Body: { "message": "your question" }
```

### Get All Answers
```bash
GET /api/answers
```

### Add Q&A (Admin)
```bash
POST /api/kb/add
Headers: { "x-admin-key": "your-secret-key" }
Body: {
  "questionTemplates": ["question 1", "question 2"],
  "answerText": "answer here"
}
```

## Sample Questions

- "What payment methods do you accept?"
- "Do I need to pay custom duty?"
- "Which brand is good for ghee?"
- "How long does shipping take?"
- "Is returns allowed?"
- "Do you have organic products?"
- "Which countries do you ship to?"
- "Best rice brand?"

## Tech Stack

- **Backend**: Node.js + Express
- **NLP**: Natural (TF-IDF, Porter Stemmer)
- **Similarity**: Levenshtein distance
- **Database**: Supabase (optional) or local JSON
- **Deployment**: Render + Vercel

## License

MIT

## Support

For issues or questions, contact: support@desifood.com
