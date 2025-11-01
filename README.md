# 🚀 CrawlBCT - Auto Crawl Bộ Công Thương

Hệ thống tự động đăng nhập và lấy thông tin từ Cổng Dịch vụ công Bộ Công Thương.

## ✨ Features

- ✅ Tự động giải captcha bằng Anti-Captcha
- ✅ Retry thông minh khi captcha sai (tối đa 3 lần)
- ✅ Phân biệt lỗi captcha vs username/password
- ✅ Xử lý batch nhiều accounts
- ✅ Gửi kết quả về N8N webhook
- ✅ Headless mode tiết kiệm RAM
- ✅ Reuse browser instance
- ✅ Error handling toàn diện

## 📋 Requirements

- Node.js 18+
- Anti-Captcha API Key
- N8N Webhook URL (optional)

## 🛠️ Local Development

### Install

```bash
npm install
```

### Config

Edit `config.js`:

```javascript
ANTICAPTCHA_KEY: "your-api-key",
WEBHOOK_URL: "your-n8n-webhook-url",
```

### Run

```bash
npm start
```

Server chạy tại: `http://localhost:3000`

### Test

POST `http://localhost:3000/api/process-batch`:

```json
{
  "accounts": [
    {
      "username": "1101991077",
      "password": "1101991077"
    }
  ]
}
```

## 🚂 Deploy to Railway

### ✅ Pre-deployment Checklist

**Trước khi deploy, đảm bảo:**

- [x] ✅ Railway config files (`railway.json`, `nixpacks.toml`) - DONE
- [x] ✅ Dependencies (`package.json`) - DONE
- [x] ✅ Environment variables (`config.js`) - DONE
- [x] ✅ Browser config for production (`processor.js`) - DONE
- [x] ✅ `.gitignore` includes `.env` - DONE
- [ ] ⚠️ **QUAN TRỌNG:** Xóa API key hardcoded khỏi Git history (nếu đã commit)

### 1. Setup Local Environment

```bash
# Copy template
cp .env.example .env

# Edit .env với API keys thật của bạn
nano .env

# Test local trước
npm install
npm start
```

### 2. Push to GitHub

```bash
# Nếu chưa có repo
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/crawlbct.git
git push -u origin main
```

### 3. Deploy Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `crawlbct` repo
5. Railway sẽ tự động:
   - Detect Node.js project
   - Install Chromium (via nixpacks.toml)
   - Build và deploy

### 4. Set Environment Variables ⚠️ QUAN TRỌNG

**Railway dashboard → Variables → Add Variables:**

```bash
ANTICAPTCHA_KEY=88194134685766492a98df9e47f4cff7
WEBHOOK_URL=https://khiemho.app.n8n.cloud/webhook/f731f7a5-7bc3-4a72-a5a3-d16309dde622
```

**Lưu ý:** Railway tự động set `PORT`, không cần thêm thủ công!

### 5. Verify Deployment

```bash
# Check logs
Railway dashboard → Deployments → View Logs

# Kiểm tra:
✅ "Browser đã khởi động!"
✅ "Server đang chạy tại..."
✅ No errors

# Test health endpoint
curl https://your-app.railway.app/health
```

### 6. Get Public URL

Railway dashboard → Settings → Generate Domain

Example: `https://crawlbct-production.up.railway.app`

## 🔌 API Endpoints

### Health Check

```
GET /health
```

### Process Batch

```
POST /api/process-batch
Content-Type: application/json

{
  "accounts": [
    { "username": "...", "password": "..." }
  ]
}
```

## 🎯 N8N Integration

### Workflow:

```
Schedule Trigger (Monthly)
    ↓
Google Sheets: Read accounts
    ↓
HTTP Request: POST to Railway URL
    ↓
Webhook: Receive results
    ↓
Google Sheets: Update results
```

### N8N Code Node (Format data):

```javascript
const accounts = [];
for (const item of $input.all()) {
  accounts.push({
    username: item.json.username,
    password: item.json.password,
  });
}
return [{ json: { accounts } }];
```

## ⚙️ Configuration

All config in `config.js`:

```javascript
ANTICAPTCHA_KEY: "...",           // Your Anti-Captcha API key
WEBHOOK_URL: "...",                // N8N webhook URL
SERVER_PORT: 3000,                 // Server port
BROWSER_HEADLESS: true,            // Headless mode
DELAY_BETWEEN_ACCOUNTS_MIN: 5000,  // Min delay (ms)
DELAY_BETWEEN_ACCOUNTS_MAX: 10000, // Max delay (ms)
```

## 📊 Performance

- **Thời gian/account:** 15-20s
- **Delay giữa accounts:** 5-10s
- **RAM usage:** ~500MB - 1GB
- **Chi phí captcha:** ~$0.001/account

## 🐛 Troubleshooting

### Railway Deployment Issues

**Build Failed:**

```bash
# Check logs in Railway dashboard
Deployments → Build Logs

# Common issues:
- Missing environment variables → Add in Railway dashboard
- Node version mismatch → Check package.json engines
- Chromium install failed → Verify nixpacks.toml
```

**Runtime Crashed:**

```bash
# Check runtime logs
Deployments → Runtime Logs

# Common issues:
- ANTICAPTCHA_KEY missing → Set in Variables
- WEBHOOK_URL missing → Set in Variables
- Browser failed to launch → Check BROWSER_ARGS in config.js
- Out of memory → Monitor usage, optimize if needed
```

**Browser Won't Start:**

```javascript
// Error: "Failed to launch browser"
// Fix: Đã config sẵn trong processor.js và nixpacks.toml
// Browser args includes --no-sandbox, --disable-setuid-sandbox
// Chromium auto-installed via nixpacks
```

### Captcha giải sai

- Check API key Anti-Captcha
- Check balance: https://anti-captcha.com/clients/finance/summary
- Script tự động retry 3 lần

### Đăng nhập thất bại

- Check username/password
- Xem logs để debug
- Script phân biệt lỗi captcha vs credentials

### Out of Memory

- Monitor usage: Railway dashboard → Metrics
- Check memory logs (logged every 30s)
- Usage > $5/month → Consider optimization hoặc upgrade plan

## 📝 Files Structure

```
CrawlBCT/
├── server.js          # Express API server
├── processor.js       # Logic xử lý account
├── config.js          # Config tập trung
├── index.js           # Script test 1 account
├── package.json
├── railway.json       # Railway config
├── nixpacks.toml      # Nixpacks config (Chromium)
└── README.md
```

## 🔒 Security Notes

- ⚠️ **KHÔNG BAO GIỜ** commit API keys lên Git
- ✅ Dùng Environment Variables (đã config sẵn trong `config.js`)
- ✅ File `.env` đã được ignore (check `.gitignore`)
- ⚠️ Nếu đã commit API key nhầm, phải:
  1. Revoke API key cũ
  2. Tạo API key mới
  3. Xóa khỏi Git history: `git filter-branch` hoặc `BFG Repo-Cleaner`
- ⚠️ Chỉ dùng cho mục đích hợp pháp

## 📞 Support

- Issues: GitHub Issues
- Email: your-email@example.com

## 📄 License

MIT

---

**Made with ❤️ for automation**
