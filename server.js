// npm install express
// Server chạy local để nhận request từ N8N và process accounts

const express = require("express");
const { processAccount } = require("./processor");
const config = require("./config");

const app = express();
app.use(express.json({ limit: "10mb" })); // Cho phép body lớn

const PORT = config.SERVER_PORT;
const WEBHOOK_URL = config.WEBHOOK_URL;

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API để N8N trigger batch processing
app.post("/api/process-batch", async (req, res) => {
  const { accounts } = req.body;

  if (!accounts || !Array.isArray(accounts)) {
    return res.status(400).json({ error: "Invalid accounts array" });
  }

  console.log(`\n🚀 Bắt đầu xử lý ${accounts.length} accounts...`);
  console.log(`⏰ Thời gian bắt đầu: ${new Date().toLocaleString()}`);

  // Trả response ngay để N8N không timeout
  res.json({
    status: "processing",
    total: accounts.length,
    message: "Batch processing started. Results will be sent to webhook.",
  });

  // Process accounts trong background
  processAccountsBatch(accounts);
});

// Hàm xử lý batch accounts
async function processAccountsBatch(accounts) {
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const progress = `[${i + 1}/${accounts.length}]`;

    console.log(`\n${progress} Đang xử lý: ${account.username}`);

    try {
      // Process account
      const result = await processAccount(account.username, account.password);

      if (result.success) {
        successCount++;
        console.log(`✅ ${progress} Thành công: ${account.username}`);

        // Gửi kết quả về webhook N8N
        await sendToWebhook({
          username: account.username,
          status: "success",
          email: result.email,
          phone: result.phone,
          timestamp: new Date().toISOString(),
        });
      } else {
        failCount++;
        console.log(
          `❌ ${progress} Thất bại: ${account.username} - ${result.error}`
        );

        // Vẫn gửi về webhook để update status
        await sendToWebhook({
          username: account.username,
          status: "failed",
          error: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      failCount++;
      console.log(`❌ ${progress} Lỗi: ${account.username} - ${error.message}`);

      await sendToWebhook({
        username: account.username,
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Delay giữa các account để tránh bị block (5-10s)
    const delay =
      config.DELAY_BETWEEN_ACCOUNTS_MIN +
      Math.random() *
        (config.DELAY_BETWEEN_ACCOUNTS_MAX - config.DELAY_BETWEEN_ACCOUNTS_MIN);
    console.log(
      `⏳ Đợi ${(delay / 1000).toFixed(
        1
      )}s trước khi xử lý account tiếp theo...`
    );
    await sleep(delay);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n✅ ====== HOÀN TẤT ======`);
  console.log(`⏱️  Thời gian: ${duration} phút`);
  console.log(`✅ Thành công: ${successCount}`);
  console.log(`❌ Thất bại: ${failCount}`);
  console.log(`📊 Tổng cộng: ${accounts.length}`);
}

// Hàm gửi kết quả về webhook N8N
async function sendToWebhook(data) {
  const axios = require("axios");
  try {
    await axios.post(WEBHOOK_URL, data, {
      timeout: 10000,
    });
  } catch (error) {
    console.log(`⚠️  Lỗi gửi webhook: ${error.message}`);
  }
}

// Helper function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📮 API endpoint: http://localhost:${PORT}/api/process-batch`);
  console.log(`\n⏳ Đang chờ request từ N8N...\n`);
});
