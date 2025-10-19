// Module xử lý từng account
// Tách riêng để dễ maintain và reuse

const ac = require("@antiadmin/anticaptchaofficial");
const puppeteer = require("puppeteer");
const config = require("./config");

// Biến global để reuse browser (tiết kiệm RAM và thời gian)
let sharedBrowser = null;

// Hàm thử đăng nhập 1 lần với captcha
async function attemptLogin(page, username, password) {
  try {
    // Lấy captcha
    const captchaBase64 = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
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

    // Giải captcha
    ac.setAPIKey(config.ANTICAPTCHA_KEY);
    ac.setSoftId(0);
    ac.settings.case = true; // Phân biệt HOA/thường

    const captchaText = await ac.solveImage(captchaBase64, true);
    console.log(`      🔐 Captcha: "${captchaText}"`);

    // Clear input fields trước
    await page.evaluate(() => {
      const inputs = [
        "#ctl00_cplhContainer_txtLoginName",
        "#ctl00_cplhContainer_txtPassword",
        "#ctl00_cplhContainer_txtCaptcha",
      ];
      inputs.forEach((selector) => {
        const el = document.querySelector(selector);
        if (el) el.value = "";
      });
    });

    // Điền form
    await page.type("#ctl00_cplhContainer_txtLoginName", username);
    await page.type("#ctl00_cplhContainer_txtPassword", password);
    await page.type("#ctl00_cplhContainer_txtCaptcha", captchaText);

    // Click đăng nhập
    await page.click("#ctl00_cplhContainer_btnLogin");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Kiểm tra kết quả
    const currentURL = page.url();

    // Lấy message error (nếu có)
    const errorMessage = await page
      .evaluate(() => {
        const messageLabel = document.querySelector(
          '[id*="Message"], [id*="Label"]'
        );
        if (messageLabel && messageLabel.textContent.trim()) {
          return messageLabel.textContent.trim();
        }

        const errorDiv = document.querySelector(
          '.error, .alert, [class*="error"]'
        );
        return errorDiv ? errorDiv.textContent.trim() : null;
      })
      .catch(() => null);

    // Vẫn ở trang login = đăng nhập fail
    if (currentURL.includes("Login.aspx")) {
      return {
        success: false,
        error: errorMessage || "Mã xác thực không đúng",
      };
    }

    // Đăng nhập thành công
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Hàm xử lý 1 account với retry cho captcha
async function processAccount(username, password) {
  let page = null;
  const MAX_CAPTCHA_RETRIES = 3;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Mở trang login
    await page.goto(config.LOGIN_URL, {
      waitUntil: "networkidle0",
      timeout: config.BROWSER_TIMEOUT,
    });
    await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");

    // Thử đăng nhập với retry
    let loginSuccess = false;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES; attempt++) {
      console.log(`   🔄 Lần thử ${attempt}/${MAX_CAPTCHA_RETRIES}`);

      const loginResult = await attemptLogin(page, username, password);

      if (loginResult.success) {
        loginSuccess = true;
        console.log(`   ✅ Đăng nhập thành công!`);
        break;
      }

      lastError = loginResult.error;

      // Check xem lỗi có phải captcha không
      const isCaptchaError =
        loginResult.error.toLowerCase().includes("xác thực") ||
        loginResult.error.toLowerCase().includes("captcha");

      if (isCaptchaError && attempt < MAX_CAPTCHA_RETRIES) {
        console.log(`   ⚠️  Captcha sai, reload trang và thử lại...`);
        // Reload trang để lấy captcha mới
        await page.goto(config.LOGIN_URL, {
          waitUntil: "networkidle0",
          timeout: config.BROWSER_TIMEOUT,
        });
        await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (!isCaptchaError) {
        // Lỗi username/password → Không retry
        console.log(`   ❌ Lỗi username/password: ${loginResult.error}`);
        break;
      }
    }

    if (!loginSuccess) {
      await page.close();
      return {
        success: false,
        error: lastError,
      };
    }

    // Bước 2: Lấy thông tin
    await page.goto(config.INFO_URL, {
      waitUntil: "networkidle0",
      timeout: config.BROWSER_TIMEOUT,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const businessInfo = await page.evaluate(() => {
      const emailInput = document.querySelector(
        'input[name*="RepresenterEmail"]'
      );
      const mobileInput = document.querySelector(
        'input[name*="RepresenterMobile"]'
      );

      return {
        email: emailInput ? emailInput.value : "",
        mobile: mobileInput ? mobileInput.value : "",
      };
    });

    await page.close();

    return {
      success: true,
      email: businessInfo.email,
      phone: businessInfo.mobile,
    };
  } catch (error) {
    if (page) await page.close();
    return {
      success: false,
      error: error.message,
    };
  }
}

// Hàm lấy hoặc tạo browser
async function getBrowser() {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    console.log("🌐 Đang khởi động browser...");
    sharedBrowser = await puppeteer.launch({
      headless: config.BROWSER_HEADLESS,
      args: config.BROWSER_ARGS,
    });
    console.log("✅ Browser đã khởi động!");
  }
  return sharedBrowser;
}

// Hàm đóng browser
async function closeBrowser() {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
    console.log("🔒 Browser đã đóng!");
  }
}

module.exports = {
  processAccount,
  closeBrowser,
};
