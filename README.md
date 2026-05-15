# 📋 FormSathi — Deployment Guide (Google Gemini Edition)
## Go Live in 20 Minutes — Completely FREE!

---

## 🗂️ Your File Structure
```
formsathi/
├── api/
│   └── chat.js        ← Backend proxy (keeps API key secure)
├── public/
│   └── index.html     ← Your complete frontend app
├── vercel.json        ← Vercel configuration
├── package.json       ← Project metadata
└── README.md          ← This guide
```

---

## 🔑 STEP 1 — Get Your FREE Gemini API Key (2 minutes)

1. Go to → **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account (Gmail)
3. Click **"Create API Key"**
4. Select **"Create API key in new project"**
5. Copy the key — it looks like: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
6. Save it — you'll paste it in Step 4

> ✅ **Gemini 2.0 Flash is 100% FREE** with generous limits:
> - 15 requests per minute
> - 1 million tokens per day
> - No credit card required

---

## 🐙 STEP 2 — Upload Files to GitHub (5 minutes)

1. Go to → **https://github.com** → Sign up / Log in
2. Click the **"+"** button (top right) → **"New repository"**
3. Name it: **`formsathi`**
4. Set to **Public** → Click **"Create repository"**
5. On the next page, click **"uploading an existing file"**
6. Drag and drop your files — IMPORTANT: keep the folder structure:
   ```
   api/chat.js
   public/index.html
   vercel.json
   package.json
   ```
7. Write a commit message: `Initial commit`
8. Click **"Commit changes"**

✅ Your code is now safely on GitHub!

---

## ▲ STEP 3 — Deploy to Vercel (3 minutes)

1. Go to → **https://vercel.com**
2. Click **"Sign Up"** → Choose **"Continue with GitHub"**
3. Click **"Add New Project"**
4. Find your **`formsathi`** repository in the list
5. Click **"Import"**
6. Leave ALL settings as default — don't change anything
7. Click **"Deploy"**
8. Wait 1-2 minutes for deployment to complete...

✅ Vercel gives you a URL like: **`https://formsathi-abc123.vercel.app`**

---

## 🔐 STEP 4 — Add Your Gemini API Key (2 minutes)

> ⚠️ Your app won't work until you complete this step!

1. In your Vercel dashboard, click on your **`formsathi`** project
2. Click **"Settings"** (top menu)
3. Click **"Environment Variables"** (left sidebar)
4. Click **"Add New"**
5. Fill in:
   - **Key:**   `GEMINI_API_KEY`
   - **Value:** paste your key from Step 1 (e.g. `AIzaSy...`)
6. Check all three environments: **Production ✓ Preview ✓ Development ✓**
7. Click **"Save"**
8. Go to **"Deployments"** tab (top menu)
9. Click the three dots **"..."** next to your latest deployment
10. Click **"Redeploy"** → Click **"Redeploy"** again in the popup

✅ Wait 1 minute → Your app is now 100% live and working!

---

## ✅ STEP 5 — Test Everything (3 minutes)

Open your Vercel URL and run these checks:

| Test | Expected Result |
|------|----------------|
| Enter name + choose Hindi → Get Started | Home screen appears in Hindi |
| Click "Government Exam" → type "SSC CGL" | AI replies in Hindi with welcome message |
| Type wrong mobile number (e.g. "12345") | AI shows ⚠️ validation error |
| Type correct mobile (e.g. "9876543210") | AI shows ✅ and moves to next field |
| Close tab → reopen URL | Your name and session still there |
| Upload a form image | AI identifies the form automatically |
| After 6+ messages → click "📋 Get Summary" | Summary modal with all your answers |

---

## 🌐 Add to Your CV

Your live URL will be something like:
```
https://formsathi.vercel.app
```

**CV Entry (copy and paste this):**

```
PROJECT: FormSathi — AI Form Filling Assistant
Live Demo: https://formsathi-yourname.vercel.app
GitHub:    https://github.com/yourname/formsathi

Description:
Built an AI-powered multilingual form-filling assistant for India 
that helps users fill government exam, scholarship, and entrance 
exam forms step-by-step through conversational AI guidance.

Key Features:
• Powered by Google Gemini 2.0 Flash API
• Supports 7 Indian languages (Hindi, Marathi, Telugu, Bengali, Tamil, Gujarati)
• Real-time field validation (DOB format, Aadhaar, PIN, mobile number)
• Session memory with localStorage (resumes after closing browser)
• Form image upload — AI reads and identifies form fields automatically  
• Printable form summary with document checklist
• Deployed on Vercel with secure API proxy (serverless functions)

Tech Stack: React, JavaScript, Google Gemini API, Vercel, HTML/CSS
```

---

## 🛠️ Making Updates

After editing any file:
1. Go to your GitHub repository
2. Click on the file → click the ✏️ pencil icon → edit → commit
3. Vercel **automatically redeploys** within 2 minutes
4. Your live site updates with no extra steps!

---

## 💰 Cost Breakdown

| Service | Free Limit | Cost After Free |
|---------|-----------|----------------|
| Vercel Hosting | Unlimited (Hobby) | Free forever |
| GitHub | Unlimited public repos | Free forever |
| Gemini 2.0 Flash API | 15 req/min, 1M tokens/day | Approx ₹0.06 per 1000 messages |

**For a portfolio project with ~500 users/month = ₹0 cost** (well within free tier)

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|---------|
| "API key error" message | Check `GEMINI_API_KEY` in Vercel → Settings → Environment Variables |
| App loads but AI doesn't reply | Vercel → your project → Functions tab → check `chat` logs |
| Changes not appearing | Vercel → Deployments → click Redeploy |
| "Too many requests" error | You've hit the 15 req/min free limit — wait 1 minute and retry |
| Image upload not working | Keep image under 4MB; use JPEG or PNG |
| Sessions not saving | Make sure browser allows localStorage (not in private mode) |

---

## 🔗 Important Links

- Your Live App:     `https://formsathi-YOURNAME.vercel.app`
- Vercel Dashboard:  https://vercel.com/dashboard
- Gemini API Studio: https://aistudio.google.com/app/apikey
- GitHub Repo:       https://github.com/YOURNAME/formsathi
- Gemini API Docs:   https://ai.google.dev/gemini-api/docs

---

*📋 FormSathi — Built for India · Powered by Google Gemini (Free) · Hosted on Vercel*
