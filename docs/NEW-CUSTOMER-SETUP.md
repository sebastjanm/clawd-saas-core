# 🚀 EasyAI Start — New Customer Setup

## Two Roles

| Task | Who | Where |
|------|-----|-------|
| Create VPS + run setup | **Admin** (Sebastjan or Oly) | Slack/Telegram request |
| DNS, customer config, communication | **You** (Account Manager) | Your laptop |

You don't need to install anything or use a terminal. Everything you need is in a browser.

---

## Your Job (Account Manager)

### Before setup: Collect customer info

Fill in this form and send it to Sebastjan on Slack/Telegram:

```
Company name: 
Company slug: (lowercase-with-dashes, e.g. mizarstvo-hrast)
Language: (sl / en / de / hr)
Domain: (e.g. factory.mizarstvo-hrast.si — or "none" if no domain yet)
Contact person:
Contact email:
Website:
Writing tone: (professional / casual / friendly / expert)
Target audience: (who reads their content?)
Special instructions: (any content rules, topics to avoid, etc.)
```

**Example:**
```
Company name: Mizarstvo Hrast
Company slug: mizarstvo-hrast
Language: sl
Domain: factory.hrast.si
Contact person: Janez Novak
Contact email: janez@hrast.si
Website: https://www.hrast.si
Writing tone: professional
Target audience: Homeowners looking for custom furniture
Special instructions: Never mention competitors. Focus on Slovenian oak.
```

---

### After setup: You'll receive from Admin

Within 30 minutes of your request, Admin will send you:

| What | Example |
|------|---------|
| Dashboard URL | `https://factory.hrast.si` |
| Access token | `a1b2c3d4e5f6...` |
| VPS IP | `168.119.45.123` |

---

### Step 1: Point the domain (if customer has one)

1. Ask the customer for access to their DNS settings (Cloudflare, GoDaddy, etc.)
   — OR ask them to add this record themselves:
2. Add an **A record**:
   - **Type:** A
   - **Name:** `factory` (or whatever subdomain they want)
   - **Value:** the VPS IP address Admin gave you
   - **TTL:** Auto / 300
3. Wait 5-10 minutes
4. Test: open `https://factory.hrast.si` in your browser — you should see a login page

> **No domain yet?** Skip this step. The dashboard works at `http://VPS-IP:4000` but without HTTPS. Add the domain later.

---

### Step 2: Test the login

1. Open the dashboard URL in your browser
2. Enter the access token
3. You should see the dashboard with the customer's project name

If it works → continue. If not → message Admin.

---

### Step 3: Send login details to customer

Use this email template:

---

**Subject:** Your AI Content Factory is ready 🚀

Hi [Name],

Your AI content factory is set up and ready!

**How to access your dashboard:**
1. Open this link: [Dashboard URL]
2. Enter this access token: [Token]
3. That's it — you're in!

**What you'll see:**
- **Pipeline** — your articles moving through writing, editing, and publishing
- **Library** — all published content
- **Settings** — pause/resume content production, adjust daily limits

Your content pipeline is currently **paused**. This gives you time to look around and make sure everything looks good. When you're ready to start producing content, just reply to this email and we'll activate it.

If you have any questions, just reply here.

Best,
[Your name]

---

### Step 4: Customer says "go" → Unpause

When the customer is ready, message Admin on Slack/Telegram:

```
Unpause: mizarstvo-hrast
```

Admin will activate it. Content starts flowing within minutes.

---

### Step 5: Save everything

Add to our **Customer Spreadsheet**:

| Field | Value |
|-------|-------|
| Company | Mizarstvo Hrast |
| Slug | mizarstvo-hrast |
| VPS IP | 168.119.45.123 |
| Domain | factory.hrast.si |
| Token | a1b2c3... |
| Language | sl |
| Status | Active / Paused |
| Start date | 2026-03-01 |
| Monthly fee | €___/month |

---

## After Onboarding

### Customer wants to pause content production
Message Admin: `Pause: mizarstvo-hrast`

### Customer forgot their token
Message Admin: `Reset token: mizarstvo-hrast`
You'll get a new token to send to the customer.

### Customer wants to change content settings
Message Admin with the changes:
```
mizarstvo-hrast:
- Change tone to "casual"  
- Add instruction: "Include pricing in every article"
- Increase daily limit to 3
```

### Dashboard is down
Message Admin: `Dashboard down: mizarstvo-hrast`
Admin will fix it (usually takes 5 minutes).

### Customer wants to cancel
Message Admin: `Cancel: mizarstvo-hrast`
Admin will shut down the VPS. Update the spreadsheet.

---

## Checklist (copy for each customer)

### Before setup
- [ ] Customer info form filled in
- [ ] Sent to Admin on Slack/Telegram
- [ ] Monthly fee agreed

### After Admin confirms setup
- [ ] Received dashboard URL + token + IP
- [ ] Domain pointed (A record)
- [ ] Login tested (you can see the dashboard)
- [ ] Login details emailed to customer
- [ ] Customer spreadsheet updated

### Go live
- [ ] Customer confirmed ready
- [ ] Asked Admin to unpause
- [ ] Admin confirmed pipeline is running
- [ ] First article published (check after 24h)

---

## FAQ

**Q: How long does setup take?**
A: Admin needs about 30 minutes from your request.

**Q: Can I access the dashboard from my phone?**
A: Yes, it works on mobile browsers.

**Q: How many articles does it produce per day?**
A: Default is 1/day. Can be increased in settings.

**Q: What if the customer's domain isn't ready yet?**
A: Start without it. We can add HTTPS later.

**Q: Can one customer have multiple projects?**
A: Yes, but each project is set up separately. Ask Admin.

**Q: Where do published articles go?**
A: Depends on the integration (WordPress, custom API, etc.). Ask Admin during setup.
