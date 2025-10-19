// Script debug server với logging chi tiết và monitor RAM
// Chạy: node debug-server.js

const express = require("express");
const { processAccount } = require("./processor");
const config = require("./config");
const os = require("os");

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = config.SERVER_PORT;

// Helper function để format memory
function formatMemory(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

// Log memory usage
function logMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  console.log("\n📊 Memory Status:");
  console.log(
    `  Node Process: ${formatMemory(memUsage.heapUsed)} / ${formatMemory(
      memUsage.heapTotal
    )}`
  );
  console.log(
    `  System: ${formatMemory(usedMem)} / ${formatMemory(totalMem)} (${(
      (usedMem / totalMem) *
      100
    ).toFixed(1)}% used)`
  );
  console.log(`  Free: ${formatMemory(freeMem)}`);

  // Cảnh báo nếu RAM thấp
  if (freeMem < 500 * 1024 * 1024) {
    // < 500MB
    console.log("⚠️  WARNING: Low memory! Consider closing other apps.");
  }
}

// Monitor memory mỗi 10 giây
setInterval(logMemoryUsage, 10000);

// Health check
app.get("/health", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: formatMemory(memUsage.heapUsed),
      heapTotal: formatMemory(memUsage.heapTotal),
      external: formatMemory(memUsage.external),
    },
    system: {
      totalMem: formatMemory(os.totalmem()),
      freeMem: formatMemory(os.freemem()),
    },
  });
});

// Test single account
app.post("/api/test-one", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  console.log(`\n🧪 Testing account: ${username}`);
  logMemoryUsage();

  try {
    const result = await processAccount(username, password);
    console.log("✅ Result:", result);
    logMemoryUsage();

    res.json({
      success: true,
      result: result,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    logMemoryUsage();

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Process batch với detailed logging
app.post("/api/process-batch", async (req, res) => {
  const { accounts } = req.body;

  if (!accounts || !Array.isArray(accounts)) {
    return res.status(400).json({ error: "Invalid accounts array" });
  }

  console.log(`\n🚀 Starting batch: ${accounts.length} accounts`);
  logMemoryUsage();

  // Return immediately
  res.json({
    status: "processing",
    total: accounts.length,
    message: "Batch processing started",
  });

  // Process in background
  processWithMonitoring(accounts);
});

async function processWithMonitoring(accounts) {
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const progress = `[${i + 1}/${accounts.length}]`;

    console.log(`\n${progress} Processing: ${account.username}`);
    console.log(
      `⏰ Time elapsed: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}m`
    );
    logMemoryUsage();

    try {
      const result = await processAccount(account.username, account.password);

      if (result.success) {
        successCount++;
        console.log(`✅ ${progress} Success: ${account.username}`);
      } else {
        failCount++;
        console.log(
          `❌ ${progress} Failed: ${account.username} - ${result.error}`
        );
      }
    } catch (error) {
      failCount++;
      console.error(`❌ ${progress} Error: ${account.username}`, error.message);

      // Force garbage collection if available
      if (global.gc) {
        console.log("🧹 Running garbage collection...");
        global.gc();
      }
    }

    // Delay between accounts
    const delay =
      config.DELAY_BETWEEN_ACCOUNTS_MIN +
      Math.random() *
        (config.DELAY_BETWEEN_ACCOUNTS_MAX - config.DELAY_BETWEEN_ACCOUNTS_MIN);
    console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n✅ ====== COMPLETED ======`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${accounts.length}`);
  logMemoryUsage();
}

// Error handler
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  logMemoryUsage();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  logMemoryUsage();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑 SIGINT received, shutting down gracefully...");
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 DEBUG Server running at http://localhost:${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🧪 Test one: POST http://localhost:${PORT}/api/test-one`);
  console.log(`📮 Batch: POST http://localhost:${PORT}/api/process-batch`);
  console.log(`\n💡 Memory monitoring every 10 seconds\n`);
  logMemoryUsage();
});
