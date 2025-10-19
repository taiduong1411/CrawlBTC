// Script test API - Gửi request đến server để test
// Chạy: node test-api.js

const axios = require("axios");

const SERVER_URL = "http://localhost:3000";

// Test data - Thêm accounts thật ở đây
const testAccounts = [
  {
    username: "1101991077",
    password: "1101991077",
  },
  // Thêm accounts khác để test
  // {
  //   username: "account2",
  //   password: "password2"
  // }
];

async function testAPI() {
  console.log("🧪 Bắt đầu test API...\n");

  // Test 1: Health check
  try {
    console.log("1️⃣ Testing health check...");
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    console.log("✅ Health check OK:", healthResponse.data);
  } catch (error) {
    console.log("❌ Health check failed:", error.message);
    console.log("\n⚠️  Đảm bảo server đang chạy: npm start\n");
    return;
  }

  // Test 2: Process batch
  try {
    console.log("\n2️⃣ Testing batch processing...");
    console.log(`📤 Gửi ${testAccounts.length} accounts...`);

    const response = await axios.post(`${SERVER_URL}/api/process-batch`, {
      accounts: testAccounts,
    });

    console.log("✅ API Response:", response.data);
    console.log(
      "\n📊 Server đang xử lý accounts. Kết quả sẽ được gửi về webhook."
    );
    console.log("⏳ Thời gian dự kiến:", testAccounts.length * 20, "giây");
    console.log("\n💡 Kiểm tra console của server để xem progress!");
  } catch (error) {
    console.log("❌ API call failed:", error.message);
    if (error.response) {
      console.log("Error response:", error.response.data);
    }
  }
}

// Chạy test
testAPI();
