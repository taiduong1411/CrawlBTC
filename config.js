// File config tập trung - Dễ dàng thay đổi cấu hình

module.exports = {
  // Anti-Captcha API Key
  ANTICAPTCHA_KEY: "88194134685766492a98df9e47f4cff7",

  // N8N Webhook URL - Nhận kết quả sau khi process
  WEBHOOK_URL:
    "https://khiemho.app.n8n.cloud/webhook/f731f7a5-7bc3-4a72-a5a3-d16309dde622",

  // Server settings
  SERVER_PORT: 3000,

  // Website URLs
  LOGIN_URL: "https://dichvucong.moit.gov.vn/Login.aspx",
  INFO_URL: "https://dichvucong.moit.gov.vn/UserBusiness/MyBusinessInfo.aspx",

  // Processing settings
  DELAY_BETWEEN_ACCOUNTS_MIN: 5000, // 5 giây
  DELAY_BETWEEN_ACCOUNTS_MAX: 10000, // 10 giây
  BROWSER_TIMEOUT: 30000, // 30 giây

  // Browser settings
  BROWSER_HEADLESS: true, // true = không hiển thị UI (tiết kiệm RAM)
  BROWSER_ARGS: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-component-extensions-with-background-pages",
    "--disable-features=TranslateUI,BlinkGenPropertyTrees",
    "--disable-ipc-flooding-protection",
    "--disable-renderer-backgrounding",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--force-color-profile=srgb",
    "--hide-scrollbars",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--disable-crash-reporter",
    "--single-process", // Chạy single process để tránh bị kill
  ],

  // Retry settings
  MAX_RETRIES: 1, // Số lần retry khi fail
  RETRY_DELAY: 3000, // 3 giây delay trước khi retry
};
