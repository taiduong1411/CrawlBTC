// npm install @antiadmin/anticaptchaofficial puppeteer
// https://github.com/anti-captcha/anticaptcha-npm

const ac = require("@antiadmin/anticaptchaofficial");
const puppeteer = require("puppeteer");
const axios = require("axios");

// Hàm đăng nhập tự động với giải captcha
async function autoLogin(username, password) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  try {
    console.log("Đang mở trang đăng nhập...");
    await page.goto("https://dichvucong.moit.gov.vn/Login.aspx", {
      waitUntil: "networkidle0",
    });

    // Đợi form load
    await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");

    console.log("Đang lấy hình captcha...");

    // Tìm hình captcha - có thể là img trong div ct100_cplhContainer_upnCaptcha
    // hoặc tìm tất cả các img và chọn cái có src chứa "GeneralCaptchaHandler"
    const captchaBase64 = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        // Tìm img có src chứa "GeneralCaptchaHandler"
        const imgs = Array.from(document.querySelectorAll("img"));
        const captchaImg = imgs.find((img) =>
          img.src.includes("GeneralCaptchaHandler")
        );

        if (!captchaImg) {
          reject(new Error("Không tìm thấy hình captcha"));
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = captchaImg.naturalWidth || captchaImg.width;
        canvas.height = captchaImg.naturalHeight || captchaImg.height;
        const ctx = canvas.getContext("2d");

        // Đợi hình load xong
        if (captchaImg.complete) {
          ctx.drawImage(captchaImg, 0, 0);
          const dataURL = canvas.toDataURL("image/png");
          resolve(dataURL.split(",")[1]);
        } else {
          captchaImg.onload = () => {
            ctx.drawImage(captchaImg, 0, 0);
            const dataURL = canvas.toDataURL("image/png");
            resolve(dataURL.split(",")[1]);
          };
          captchaImg.onerror = () => reject(new Error("Không load được hình"));
        }
      });
    });

    console.log("Đã lấy captcha, đang gửi đến anti-captcha...");

    // Cấu hình anti-captcha
    ac.setAPIKey("88194134685766492a98df9e47f4cff7");
    ac.setSoftId(0);

    // Giải captcha
    const captchaText = await ac.solveImage(captchaBase64, true);
    console.log("Captcha đã giải: " + captchaText);

    // Điền thông tin đăng nhập
    console.log("Đang điền thông tin đăng nhập...");

    // Điền tên đăng nhập
    await page.type("#ctl00_cplhContainer_txtLoginName", username);

    // Điền mật khẩu
    await page.type("#ctl00_cplhContainer_txtPassword", password);

    // Điền captcha
    await page.type("#ctl00_cplhContainer_txtCaptcha", captchaText);

    console.log("Đã điền xong thông tin!");
    console.log("- Tên đăng nhập: " + username);
    console.log("- Mật khẩu: " + password);
    console.log("- Mã xác thực: " + captchaText);

    // Đợi 2 giây để bạn xem
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click nút đăng nhập
    console.log("Đang nhấn nút đăng nhập...");

    // Click nút đăng nhập (từ DevTools thấy có thể là input hoặc button với ID này)
    await page.click("#ctl00_cplhContainer_btnLogin");

    // Đợi chuyển trang sau khi đăng nhập
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Kiểm tra xem đăng nhập có thành công không
    const currentURL = page.url();
    console.log("URL hiện tại:", currentURL);

    // Nếu vẫn ở trang login hoặc có chứa "Login.aspx" => đăng nhập thất bại
    if (currentURL.includes("Login.aspx")) {
      console.log(
        "❌ Đăng nhập thất bại! Tên đăng nhập hoặc mật khẩu không đúng."
      );
      console.log("Script dừng lại tại đây.");
      console.log("Đang đóng trình duyệt...");
      await browser.close();
      return;
    }

    console.log("✅ Đăng nhập thành công!");
    console.log("\n=== Bước 2: Truy cập trang thông tin doanh nghiệp ===");

    // Đi đến trang thông tin doanh nghiệp
    await page.goto(
      "https://dichvucong.moit.gov.vn/UserBusiness/MyBusinessInfo.aspx",
      {
        waitUntil: "networkidle0",
      }
    );

    console.log("Đã vào trang thông tin doanh nghiệp");

    // Đợi trang load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Lấy thông tin Email và Điện thoại di động
    const businessInfo = await page.evaluate(() => {
      // Tìm input có name chứa "RepresenterEmail"
      const emailInput = document.querySelector(
        'input[name*="RepresenterEmail"]'
      );
      // Tìm input có name chứa "RepresenterMobile"
      const mobileInput = document.querySelector(
        'input[name*="RepresenterMobile"]'
      );

      return {
        email: emailInput ? emailInput.value : "Không tìm thấy",
        mobile: mobileInput ? mobileInput.value : "Không tìm thấy",
      };
    });

    console.log("\n=== Thông tin doanh nghiệp ===");
    console.log("Email: " + businessInfo.email);
    console.log("Điện thoại di động: " + businessInfo.mobile);

    // Gửi thông tin đến webhook
    console.log("\n=== Bước 3: Gửi thông tin đến webhook ===");

    const webhookURL =
      "https://khiemho.app.n8n.cloud/webhook-test/f731f7a5-7bc3-4a72-a5a3-d16309dde622";
    const dataToSend = {
      username: username,
      email: businessInfo.email,
      phone: businessInfo.mobile,
    };

    try {
      const webhookResponse = await axios.post(webhookURL, dataToSend);
      console.log("✅ Đã gửi thông tin đến webhook thành công!");
      console.log("Response status:", webhookResponse.status);
    } catch (error) {
      console.log("❌ Lỗi khi gửi webhook:", error.message);
    }

    // Đợi 2 giây
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("\n=== Bước 4: Đăng xuất ===");

    // Tìm và click nút đăng xuất
    // Thường nút logout có text "Đăng xuất" hoặc link có href chứa "Logout"
    const logoutClicked = await page.evaluate(() => {
      // Tìm tất cả các link
      const links = Array.from(document.querySelectorAll("a"));
      const logoutLink = links.find(
        (link) =>
          link.textContent.includes("Đăng xuất") ||
          link.href.includes("Logout") ||
          link.href.includes("logout")
      );

      if (logoutLink) {
        logoutLink.click();
        return true;
      }
      return false;
    });

    if (logoutClicked) {
      console.log("Đã click nút đăng xuất");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Đăng xuất thành công!");
    } else {
      console.log("Không tìm thấy nút đăng xuất");
    }

    console.log("\n=== Hoàn tất! ===");
    console.log("Đang đóng trình duyệt...");

    // Đóng browser để giải phóng RAM
    await browser.close();
    console.log("Đã đóng trình duyệt!");
  } catch (error) {
    console.log("Lỗi: " + error);
    console.log("Đang đóng trình duyệt...");
    await browser.close();
    throw error;
  }
}

// Chạy với thông tin đăng nhập
const username = "1101991077";
const password = "1101991077";

autoLogin(username, password);
