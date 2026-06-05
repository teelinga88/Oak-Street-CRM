# Oak Street Logistics CRM

A React + Firebase CRM for the Oak Street Logistics sales team.

## Tech Stack
- **React** — frontend
- **Firebase Authentication** — email/password login per rep
- **Firestore** — real-time database
- **Vercel** — hosting

---

## Team Emails (set these up in Firebase Auth)

| Rep | Email | Manager? |
|-----|-------|----------|
| Alex Teeling | alex@oakstreetlogistics.com | ✅ |
| Bobby O'Brien | bobby@oakstreetlogistics.com | ✅ |
| Bryan Clifford | bryan@oakstreetlogistics.com | — |
| Charles Tolson | charles@oakstreetlogistics.com | — |

---

## Setup Steps

### 1. Create rep accounts in Firebase

Go to **Firebase Console → Authentication → Users → Add user** and create one account per rep using the emails above.

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

```bash
npm start
```

### 4. Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import from GitHub
3. Vercel will auto-detect it as a React app and deploy

---

## Firestore Collections

| Collection | Description |
|------------|-------------|
| `accounts` | All shipper accounts |
| `deals` | Pipeline prospects |
| `followups` | Follow-up reminders |
| `bucket` | Cold call bucket leads |

---

## Importing Alex's Accounts

After deploying, run the seed script (coming soon) or add accounts manually via the CRM.
