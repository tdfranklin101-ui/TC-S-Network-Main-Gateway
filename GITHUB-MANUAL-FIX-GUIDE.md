# Fix Shared Dependency - GitHub Web Interface

Since git push is restricted, here's the **easiest way** to fix all 13 repositories using GitHub's web interface:

---

## 🎯 Quick Fix (5 minutes for all 13 repos)

### For Each Repository:

1. **Go to the repository on GitHub**
   - Example: https://github.com/tdfranklin101-ui/TC-S-Network-Marketplace

2. **Click on `package.json`**
   - It's in the root directory

3. **Click the pencil icon (✏️) to edit**
   - Top right of the file view

4. **Find this line:**
   ```json
   "@tcs-network/shared": "1.0.0"
   ```

5. **Replace with:**
   ```json
   "@tcs-network/shared": "git+https://github.com/tdfranklin101-ui/TC-S-Network-Shared.git"
   ```

6. **Scroll down and click "Commit changes"**
   - Add message: `Fix: Use GitHub URL for shared dependency`
   - Click green "Commit changes" button

7. **Repeat for next repository**

---

## 📋 All 13 Repositories to Fix

1. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Marketplace ← **START HERE**
2. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Wallet
3. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Members
4. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Kid-Solar
5. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Music-System
6. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Solar-Dashboard
7. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Solar-Standard
8. ✅ https://github.com/tdfranklin101-ui/TC-S-SAI-Dashboard
9. ✅ https://github.com/tdfranklin101-ui/TC-S-UIM-Layer
10. ✅ https://github.com/tdfranklin101-ui/TC-S-Commissioning-Engine
11. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Satellite-ID-Anywhere
12. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Ledger
13. ✅ https://github.com/tdfranklin101-ui/TC-S-Network-Z-Private

---

## 🚀 After Fixing Marketplace

Once you fix **just the Marketplace** repository:

1. Go to your Vercel dashboard
2. Find: TC-S-Network-Marketplace project
3. Click: "Deployments"
4. Click: "Redeploy" or "Deploy latest"
5. ✅ **Build will succeed!**

Then you can fix the other 12 at your leisure.

---

## ⚡ Even Faster Method

If you want to do this super fast, I can create a script that uses GitHub API to update all 13 files automatically. Would you like me to do that?

---

**Current Status:**
- ✅ All repositories exist on GitHub
- ✅ Code is pushed and committed
- ⚠️ Just need to change 1 line in package.json in each repo
- ✅ Can be done via GitHub web interface (super easy)

---

