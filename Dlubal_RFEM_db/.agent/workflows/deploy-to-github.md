---
description: How to deploy the RFEM Block Generator project to GitHub
---

# Deploy to GitHub — Step by Step

## Prerequisites
- Git is installed (`git --version` to verify)
- You have a GitHub account (https://github.com)
- Your Git username/email are configured (already set: `Usman-Kharal`)

## ⚠️ Pre-Flight Checklist
Before pushing, verify these files are in place:
- [x] `.gitignore` — prevents secrets & junk from being committed
- [x] `requirements.txt` — lists Python dependencies
- [x] `README.md` — project documentation
- [x] `.env.example` — shows required environment variables (without real keys)
- [x] `config.ini.template` — shows config format (without real keys)

---

## Step 1: Create the GitHub Repository

1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `RFEM-Block-Generator` (or your preferred name)
   - **Description**: `AI-powered structural block generator for Dlubal RFEM 6`
   - **Visibility**: Public or Private (your choice)
   - **Do NOT** check "Add a README" (we already have one)
   - **Do NOT** check "Add .gitignore" (we already have one)
3. Click **Create repository**
4. **Copy the repository URL** (e.g., `https://github.com/Usman-Kharal/RFEM-Block-Generator.git`)

---

## Step 2: Initialize Git in Your Project

Open a terminal in the project folder and run:

```powershell
cd C:\Users\ADMIN\Desktop\Database\Code\Dlubal_RFEM_db
git init
```

---

## Step 3: Verify .gitignore is Working

```powershell
git status
```

You should see the project files listed, but NOT:
- `config.ini` (contains your API key!)
- `__pycache__/`
- `node_modules/`
- `*_generated.JS` files
- `.env`

If `config.ini` appears in the list, something is wrong with `.gitignore`.

---

## Step 4: Stage All Files

```powershell
git add .
```

Then verify what will be committed:

```powershell
git status
```

**Double-check** that `config.ini` and any `.env` file are NOT in the staged list.

---

## Step 5: Make the First Commit

```powershell
git commit -m "Initial commit: RFEM Structural Block Generator"
```

---

## Step 6: Connect to GitHub

Replace the URL with YOUR repository URL from Step 1:

```powershell
git remote add origin https://github.com/Usman-Kharal/RFEM-Block-Generator.git
```

---

## Step 7: Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

If prompted, enter your GitHub credentials. If you use 2FA, you'll need a **Personal Access Token** instead of your password:
1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes: `repo` (full control)
4. Copy the token and use it as your password when pushing

---

## Step 8: Verify on GitHub

1. Go to your repository URL: `https://github.com/Usman-Kharal/RFEM-Block-Generator`
2. Verify:
   - ✅ README.md renders nicely on the main page
   - ✅ `config.ini` is NOT visible (only `config.ini.template` should be)
   - ✅ No `_generated.JS` files in 2D/ or 3D/ folders
   - ✅ No `node_modules/` folder
   - ✅ No `__pycache__/` folder

---

## 🔄 Future Updates

After making changes, push them with:

```powershell
git add .
git commit -m "Description of your changes"
git push
```
