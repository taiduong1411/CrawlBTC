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

// API để N8N trigger batch processing với auto-split batches
app.post("/api/process-batch", async (req, res) => {
  const { accounts, batchSize = 100 } = req.body;

  if (!accounts || !Array.isArray(accounts)) {
    return res.status(400).json({ error: "Invalid accounts array" });
  }

  const totalBatches = Math.ceil(accounts.length / batchSize);
  const estimatedMinutes = Math.ceil((accounts.length * 25) / 60); // 25s per account

  console.log(`\n🚀 Nhận ${accounts.length} accounts`);
  console.log(
    `📦 Sẽ chia thành ${totalBatches} batches × ${batchSize} accounts`
  );
  console.log(`⏰ Thời gian ước tính: ~${estimatedMinutes} phút`);
  console.log(`⏰ Bắt đầu: ${new Date().toLocaleString()}`);

  // Trả response ngay để N8N không timeout
  res.json({
    status: "processing",
    total: accounts.length,
    batches: totalBatches,
    batchSize: batchSize,
    estimatedMinutes: estimatedMinutes,
    message: `Processing ${accounts.length} accounts in ${totalBatches} batches. Results will be sent to webhook.`,
  });

  // Process accounts trong background với auto-batching
  processAccountsInBatches(accounts, batchSize);
});

// Hàm xử lý accounts với auto-batching
async function processAccountsInBatches(accounts, batchSize) {
  const { closeBrowser } = require("./processor");
  const totalBatches = Math.ceil(accounts.length / batchSize);
  const overallStartTime = Date.now();
  let overallSuccess = 0;
  let overallFail = 0;

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, accounts.length);
    const batchAccounts = accounts.slice(start, end);

    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `📦 BATCH ${batchIndex + 1}/${totalBatches} - Processing ${
        batchAccounts.length
      } accounts (${start + 1}-${end}/${accounts.length})`
    );
    console.log(`⏰ Batch start: ${new Date().toLocaleString()}`);
    console.log(`${"=".repeat(60)}\n`);

    // Process batch
    const batchResult = await processAccountsBatch(
      batchAccounts,
      batchIndex + 1,
      totalBatches
    );

    overallSuccess += batchResult.successCount;
    overallFail += batchResult.failCount;

    console.log(`\n✅ Batch ${batchIndex + 1} completed!`);
    console.log(`   Success: ${batchResult.successCount}`);
    console.log(`   Failed: ${batchResult.failCount}`);
    console.log(`   Duration: ${batchResult.duration} phút`);

    // Restart browser giữa các batches để tránh memory leak
    if (batchIndex < totalBatches - 1) {
      console.log(`\n🔄 Restarting browser before next batch...`);
      try {
        await closeBrowser();
        // Delay 5s để cleanup memory
        await sleep(5000);
        console.log(`✅ Browser restarted successfully!\n`);
      } catch (error) {
        console.log(`⚠️  Browser restart warning: ${error.message}`);
      }
    }
  }

  // Final summary
  const overallDuration = ((Date.now() - overallStartTime) / 1000 / 60).toFixed(
    2
  );
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎉 ALL BATCHES COMPLETED!`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📊 Total accounts: ${accounts.length}`);
  console.log(`📦 Total batches: ${totalBatches}`);
  console.log(`✅ Total success: ${overallSuccess}`);
  console.log(`❌ Total failed: ${overallFail}`);
  console.log(`⏱️  Total duration: ${overallDuration} phút`);
  console.log(`⏰ Finished at: ${new Date().toLocaleString()}`);
  console.log(`${"=".repeat(60)}\n`);
}

// Hàm xử lý 1 batch accounts
async function processAccountsBatch(accounts, batchNum = 1, totalBatches = 1) {
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const progress = `[Batch ${batchNum}/${totalBatches}][${i + 1}/${
      accounts.length
    }]`;

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
          batch: batchNum,
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
          batch: batchNum,
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
        batch: batchNum,
        timestamp: new Date().toISOString(),
      });
    }

    // Delay giữa các account để tránh bị block (5-10s)
    if (i < accounts.length - 1) {
      // Không delay sau account cuối cùng
      const delay =
        config.DELAY_BETWEEN_ACCOUNTS_MIN +
        Math.random() *
          (config.DELAY_BETWEEN_ACCOUNTS_MAX -
            config.DELAY_BETWEEN_ACCOUNTS_MIN);
      console.log(
        `⏳ Đợi ${(delay / 1000).toFixed(
          1
        )}s trước khi xử lý account tiếp theo...`
      );
      await sleep(delay);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

  return {
    successCount,
    failCount,
    duration,
  };
}

// Hàm gửi kết quả về webhook N8N
async function sendToWebhook(data) {
  const axios = require("axios");
  try {
    await axios.post(WEBHOOK_URL, data, {
      timeout: 10000,
    });
    console.log(`✅ Đã gửi webhook cho: ${data.username}`);
  } catch (error) {
    console.log(`⚠️  Lỗi gửi webhook cho ${data.username}: ${error.message}`);
    // Không throw error, tiếp tục xử lý accounts khác
  }
}

// Helper function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Error handlers - Bắt lỗi để không crash
process.on("uncaughtException", (error) => {
  console.error("\n❌ Uncaught Exception:", error);
  console.error("Stack:", error.stack);
  // Không exit, server tiếp tục chạy
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n❌ Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
  // Không exit, server tiếp tục chạy
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑 SIGINT received (Ctrl+C), shutting down gracefully...");
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📮 API endpoint: http://localhost:${PORT}/api/process-batch`);
  console.log(`\n⏳ Đang chờ request từ N8N...\n`);
});
