# 🚀 EasyAI Start — New Customer Setup Guide

**For:** Non-technical team members
**Time:** ~15 minutes
**What you need:** Hetzner account, customer's company name, domain (optional)

---

## Step 1: Create a VPS on Hetzner

1. Go to https://console.hetzner.cloud
2. Click **"Add Server"**
3. Choose these settings:
   - **Location:** Nuremberg (or closest to customer)
   - **Image:** Ubuntu 22.04
   - **Type:** CX22 (2 vCPU, 4 GB RAM) — €4.35/month
   - **SSH Key:** Select "easyai-deploy" (already saved in Hetzner)
   - **Name:** customer name, e.g. `easyai-mizarstvo-hrast`
4. Click **"Create & Buy Now"**
5. **Write down the IP address** (e.g. `168.119.xxx.xxx`)

---

## Step 2: Point the domain (skip if no domain yet)

1. Go to the customer's DNS provider (Cloudflare, GoDaddy, etc.)
2. Add an **A record**:
   - **Name:** e.g. `factory` (for factory.customer.com)
   - **Value:** the IP address from Step 1
   - **TTL:** Auto
3. Wait 5-10 minutes for DNS to propagate

You can check if it works: `ping factory.customer.com`

---

## Step 3: Connect to the VPS

Open Terminal (Mac) or Command Prompt (Windows with SSH):

```
ssh root@168.119.xxx.xxx
```

Type `yes` when asked about fingerprint.

---

## Step 4: Create a user

Don't run the factory as root. Create a normal user:

```
adduser easyai
```

- Set a password (write it down somewhere safe)
- Press Enter for all the other questions

Give the user admin rights:

```
usermod -aG sudo easyai
```

Allow the user to use SSH:

```
cp -r ~/.ssh /home/easyai/.ssh
chown -R easyai:easyai /home/easyai/.ssh
```

Switch to the new user:

```
su - easyai
```

---

## Step 5: Run the setup script

Copy and paste this. Replace the four values:

```
curl -sL https://raw.githubusercontent.com/sebastjanm/clawd-saas-core/main/provision-customer.sh -o setup.sh
chmod +x setup.sh
./setup.sh "CUSTOMER-SLUG" "COMPANY NAME" "LANGUAGE" "DOMAIN"
```

**Replace:**
| Placeholder | What to put | Example |
|-------------|-------------|---------|
| CUSTOMER-SLUG | lowercase with dashes | `mizarstvo-hrast` |
| COMPANY NAME | full name in quotes | `"Mizarstvo Hrast"` |
| LANGUAGE | `sl`, `en`, `de`, `hr` | `sl` |
| DOMAIN | customer's domain | `factory.hrast.si` |

**Full example:**
```
./setup.sh mizarstvo-hrast "Mizarstvo Hrast" sl factory.hrast.si
```

☕ Wait about 3 minutes. Everything installs automatically.

---

## Step 6: Save the credentials

The script prints:

```
🎉 DONE
============================================
Customer:   Mizarstvo Hrast (mizarstvo-hrast)
Dashboard:  https://factory.hrast.si
🔑 Token: a1b2c3d4e5f6...
```

**⚠️ COPY THE TOKEN NOW.** This is the customer's login password.

Save in the customer spreadsheet:

| Field | Value |
|-------|-------|
| Company | Mizarstvo Hrast |
| Slug | mizarstvo-hrast |
| VPS IP | 168.119.xxx.xxx |
| Domain | factory.hrast.si |
| Token | a1b2c3d4e5f6... |
| Language | sl |
| Date | 2026-03-01 |

---

## Step 7: Register for health monitoring

SSH into **our main server** (not the customer's VPS):

```
ssh clawdbot@OUR-SERVER-IP
echo "mizarstvo-hrast|168.119.xxx.xxx|4001" >> ~/.saas-customers
```

Test:
```
~/clawd-saas-core/scripts/customer-health.sh
```

Should show: `✅ mizarstvo-hrast — up 0.0h`

---

## Step 8: Configure the project

On the **customer's VPS**:

```
ssh easyai@168.119.xxx.xxx
nano ~/clawd-saas-core/projects/mizarstvo-hrast.json
```

Fill in these fields:
- `website` → customer's website
- `contact.primary_name` → contact person name
- `contact.email` → their email
- `writing.tone` → "professional", "casual", "friendly"
- `writing.target_audience` → who reads their content
- `writing.guidelines` → specific content instructions

Save: `Ctrl+O`, then `Ctrl+X`

---

## Step 9: Send login details to customer

Email template:

> **Subject:** Your AI Content Factory is ready
>
> Hi [Name],
>
> Your content factory is live!
>
> **Dashboard:** https://factory.your-domain.com
> **Access token:** [paste token here]
>
> To log in: open the URL, enter the token, done.
>
> Your pipeline is currently **paused**. Let us know when you're ready to start producing content.

---

## Step 10: Unpause when ready

When customer says go, SSH into their VPS:

```
ssh easyai@168.119.xxx.xxx
curl -X POST http://localhost:4001/pipeline/pause \
  -H 'Content-Type: application/json' \
  -d '{"project":"mizarstvo-hrast","paused":false}'
```

Content starts flowing! 🎉

---

## Troubleshooting

**Dashboard won't load:**
```
ssh easyai@VPS-IP
pm2 list                    # Check if services are running
pm2 restart saas-dashboard  # Restart dashboard
pm2 restart saas-router     # Restart router
```

**"502 Bad Gateway":**
```
pm2 restart saas-dashboard
```

**Customer forgot their token:**
```
ssh easyai@VPS-IP
NEW_TOKEN=$(openssl rand -hex 24)
echo "New token: $NEW_TOKEN"
sed -i "s/DASHBOARD_TOKEN=.*/DASHBOARD_TOKEN=$NEW_TOKEN/" ~/clawd-saas-core/.env
cp ~/clawd-saas-core/.env ~/clawd-saas-core/dashboard/.env.local
pm2 restart saas-dashboard
```
Send the new token to the customer.

**Health check says "unreachable":**
```
ssh easyai@VPS-IP        # If this fails → VPS is down → restart in Hetzner console
pm2 list                 # If services stopped → pm2 restart all
```

---

## Checklist (copy for each customer)

- [ ] Hetzner VPS created
- [ ] Domain A record pointed
- [ ] Setup script completed
- [ ] Token saved in spreadsheet
- [ ] Added to health monitoring
- [ ] Project config filled in
- [ ] Login details sent to customer
- [ ] Customer confirmed settings
- [ ] Pipeline unpaused
