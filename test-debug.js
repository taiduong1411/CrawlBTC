// Script test nhanh với 1 account để debug
// Chạy: node test-debug.js

const axios = require("axios");

const SERVER_URL = "http://localhost:3000";

async function testDebug() {
  console.log("🧪 Testing debug server...\n");

  try {
    // 1. Health check
    console.log("1️⃣ Health check...");
    const health = await axios.get(`${SERVER_URL}/health`);
    console.log("✅ Server OK");
    console.log("   Memory:", health.data.memory);
    console.log("   System:", health.data.system);
    console.log("");

    // 2. Test với 1 account
    console.log("2️⃣ Testing với 1 account...");
    console.log("⏳ Đang xử lý (có thể mất 20-30s)...\n");

    const startTime = Date.now();
    const response = await axios.post(
      `${SERVER_URL}/api/process-batch`,
      {
        accounts: [
          {
            username: "1101991077",
            password: "1101991077",
          },
        ],
      },
      { timeout: 60000 } // 60s timeout
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Test completed in ${duration}s`);
    console.log("📊 Result:", response.data);
    console.log(
      "\n💡 Kết quả sẽ được gửi về webhook. Check terminal server để xem progress!"
    );
  } catch (error) {
    console.error("\n❌ Test failed:");
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Error:", error.response.data);
    } else if (error.code === "ECONNREFUSED") {
      console.error("   Server not running!");
      console.error("\n💡 Start server first: npm run debug");
    } else {
      console.error("   ", error.message);
    }
  }
}

testDebug();
