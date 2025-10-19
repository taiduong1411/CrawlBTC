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

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/crawlbct.git
git push -u origin main
```

### 2. Deploy Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `crawlbct` repo
5. Railway auto deploy!

### 3. Set Environment Variables

In Railway dashboard → Variables:

```
ANTICAPTCHA_KEY=your-key
WEBHOOK_URL=your-webhook-url
PORT=3000
```

### 4. Get Public URL

Railway dashboard → Settings → Generate Domain

You'll get: `https://crawlbct-production.up.railway.app`

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

### Captcha giải sai

- Check API key Anti-Captcha
- Check balance: https://anti-captcha.com/clients/finance/summary
- Script tự động retry 3 lần

### Đăng nhập thất bại

- Check username/password
- Xem logs để debug
- Script phân biệt lỗi captcha vs credentials

### Out of Memory

- Đảm bảo Railway có đủ RAM (512MB+)
- Check logs: `railway logs`

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

- ⚠️ Không commit API keys lên Git
- ⚠️ Dùng Environment Variables
- ⚠️ Chỉ dùng cho mục đích hợp pháp

## 📞 Support

- Issues: GitHub Issues
- Email: your-email@example.com

## 📄 License

MIT

---

**Made with ❤️ for automation**
