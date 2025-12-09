// Module xử lý từng account
// Tách riêng để dễ maintain và reuse

const ac = require("@antiadmin/anticaptchaofficial");
const puppeteer = require("puppeteer");
const axios = require("axios");
const config = require("./config");

// Biến global để reuse browser (tiết kiệm RAM và thời gian)
let sharedBrowser = null;

// Biến đếm số lần đăng nhập sai liên tiếp (để trigger dummy login sau 4 lần)
let consecutiveFailedLogins = 0;

// Hàm gửi system error webhook (GỬI ĐẾN WEBHOOK_URL_ALERTS)
async function sendSystemErrorWebhook(errorData) {
  try {
    await axios.post(config.WEBHOOK_URL_ALERTS, errorData, { timeout: 10000 });
    console.log(`🚨 Đã gửi system error webhook: ${errorData.errorType}`);
  } catch (error) {
    console.log(`⚠️  Lỗi gửi system error webhook: ${error.message}`);
  }
}

// Tài khoản "dummy" để tránh bị khóa khi đăng nhập sai nhiều lần
const DUMMY_ACCOUNT = {
  username: "0309578981",
  password: "0309578981",
};

// Hàm thử đăng nhập 1 lần với captcha
async function attemptLogin(page, username, password) {
  try {
    // Lấy captcha với retry nếu chưa load
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

        // Force reload captcha image để tránh cache
        const originalSrc = captchaImg.src;
        captchaImg.src = originalSrc + "&t=" + Date.now();

        const canvas = document.createElement("canvas");

        const drawImage = () => {
          canvas.width = captchaImg.naturalWidth || captchaImg.width;
          canvas.height = captchaImg.naturalHeight || captchaImg.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(captchaImg, 0, 0);
          const dataURL = canvas.toDataURL("image/png");
          resolve(dataURL.split(",")[1]);
        };

        if (captchaImg.complete && captchaImg.naturalWidth > 0) {
          drawImage();
        } else {
          captchaImg.onload = drawImage;
          captchaImg.onerror = () => reject(new Error("Không load được hình"));
        }
      });
    });

    // Giải captcha với settings tối ưu
    ac.setAPIKey(config.ANTICAPTCHA_KEY);
    ac.setSoftId(0);

    // Settings cho captcha
    ac.settings.case = true; // Case sensitive
    ac.settings.numeric = 0; // 0 = không biết, 1 = chỉ số, 2 = chỉ chữ
    ac.settings.minLength = 4; // Độ dài tối thiểu
    ac.settings.maxLength = 10; // Độ dài tối đa

    const captchaTextRaw = await ac.solveImage(captchaBase64, true);

    // ⚠️ CRITICAL: Cleanup captcha text
    // - Remove spaces
    // - Trim whitespace
    // - Normalize characters
    let captchaText = captchaTextRaw.trim().replace(/\s+/g, "");

    // Log cả raw và cleaned
    console.log(`      🔐 Captcha giải được (raw): "${captchaTextRaw}"`);
    console.log(`      🔐 Captcha sau khi cleanup: "${captchaText}"`);

    // Validate captcha không rỗng
    if (!captchaText || captchaText.length < 3) {
      throw new Error(`Captcha text không hợp lệ: "${captchaTextRaw}"`);
    }

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
    await page.type("#ctl00_cplhContainer_txtLoginName", username, {
      delay: 30, // Type với delay để tránh auto-complete
    });
    await page.type("#ctl00_cplhContainer_txtPassword", password, {
      delay: 30,
    });

    // ⚠️ QUAN TRỌNG: Điền captcha cẩn thận
    const captchaInput = await page.$("#ctl00_cplhContainer_txtCaptcha");
    if (captchaInput) {
      // Clear field trước
      await captchaInput.click({ clickCount: 3 }); // Select all
      await page.keyboard.press("Backspace");

      // Type từng ký tự để đảm bảo không có spaces
      for (const char of captchaText) {
        await page.keyboard.type(char, { delay: 100 });
      }

      // Verify value đã điền đúng
      const filledValue = await page.evaluate(() => {
        const el = document.querySelector("#ctl00_cplhContainer_txtCaptcha");
        return el ? el.value : "";
      });

      if (filledValue !== captchaText) {
        console.log(
          `      ⚠️  Warning: Captcha filled "${filledValue}" != expected "${captchaText}"`
        );
        // Force set value
        await page.evaluate((text) => {
          const el = document.querySelector("#ctl00_cplhContainer_txtCaptcha");
          if (el) el.value = text;
        }, captchaText);
      }

      console.log(`      ✅ Captcha đã điền: "${captchaText}"`);
    } else {
      // Fallback: dùng page.type
      await page.type("#ctl00_cplhContainer_txtCaptcha", captchaText, {
        delay: 100,
      });
    }

    // Đợi một chút trước khi submit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Click đăng nhập
    await page.click("#ctl00_cplhContainer_btnLogin");
    console.log(`      ⏳ Đợi 7s để trình duyệt load kết quả...`);
    await new Promise((resolve) => setTimeout(resolve, 7000));

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
        // Reset counter khi đăng nhập thành công
        consecutiveFailedLogins = 0;
        break;
      }

      lastError = loginResult.error;

      // Check xem lỗi có phải captcha không
      const isCaptchaError =
        loginResult.error.toLowerCase().includes("xác thực") ||
        loginResult.error.toLowerCase().includes("captcha");

      if (isCaptchaError && attempt < MAX_CAPTCHA_RETRIES) {
        console.log(`   ⚠️  Captcha sai, reload trang và thử lại...`);

        // Lưu captcha URL cũ để so sánh
        const oldCaptchaSrc = await page.evaluate(() => {
          const img = Array.from(document.querySelectorAll("img")).find((img) =>
            img.src.includes("GeneralCaptchaHandler")
          );
          return img ? img.src : null;
        });

        // Force reload với cache bypass
        await page.goto(config.LOGIN_URL, {
          waitUntil: "networkidle0",
          timeout: config.BROWSER_TIMEOUT,
        });

        // Đợi form load
        await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");

        // Đợi captcha image xuất hiện
        await page.waitForSelector('img[src*="GeneralCaptchaHandler"]', {
          timeout: 5000,
        });

        // ⚠️ CRITICAL: Đợi captcha URL thay đổi (captcha mới thật sự)
        let captchaChanged = false;
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Đợi 0.5s

          const newCaptchaSrc = await page.evaluate(() => {
            const img = Array.from(document.querySelectorAll("img")).find(
              (img) => img.src.includes("GeneralCaptchaHandler")
            );
            return img ? img.src : null;
          });

          if (newCaptchaSrc !== oldCaptchaSrc) {
            captchaChanged = true;
            console.log(
              `   ✅ Captcha URL đã thay đổi, captcha MỚI confirmed!`
            );
            break;
          }
        }

        if (!captchaChanged) {
          console.log(
            `   ⚠️  Warning: Captcha URL chưa đổi, nhưng vẫn tiếp tục...`
          );
        }

        // Đợi thêm 2s để captcha render
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log(`   🔄 Sẵn sàng lấy captcha mới...`);
      } else if (isCaptchaError && attempt === MAX_CAPTCHA_RETRIES) {
        // Captcha fail 3 lần → GỬI SYSTEM ERROR WEBHOOK
        console.log(
          `   🚨 SYSTEM ERROR: Captcha fail ${MAX_CAPTCHA_RETRIES} lần!`
        );
        await sendSystemErrorWebhook({
          type: "system_error",
          errorType: "captcha_max_retries",
          message: `⚠️ Captcha giải sai ${MAX_CAPTCHA_RETRIES} lần liên tiếp`,
          username: username,
          details: `Không thể giải captcha sau ${MAX_CAPTCHA_RETRIES} lần thử`,
          timestamp: new Date().toISOString(),
        });
      } else if (!isCaptchaError) {
        // Lỗi username/password
        console.log(`   ❌ Lỗi username/password: ${loginResult.error}`);

        // Tăng counter cho failed logins liên tiếp
        consecutiveFailedLogins++;
        console.log(
          `   📊 Số lần đăng nhập sai liên tiếp: ${consecutiveFailedLogins}`
        );

        // Chỉ đăng nhập dummy sau 4 lần sai liên tiếp
        if (consecutiveFailedLogins >= 4) {
          console.log(
            `   🔄 Đã sai ${consecutiveFailedLogins} lần → Đăng nhập tài khoản dummy để tránh bị khóa...`
          );

          // Reload trang
          await page.goto(config.LOGIN_URL, {
            waitUntil: "networkidle0",
            timeout: config.BROWSER_TIMEOUT,
          });
          await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Đăng nhập với dummy account (tối đa 2 lần thử)
          let dummySuccess = false;
          for (let i = 1; i <= 2; i++) {
            console.log(`      🔓 Thử đăng nhập dummy (lần ${i}/2)...`);
            const dummyResult = await attemptLogin(
              page,
              DUMMY_ACCOUNT.username,
              DUMMY_ACCOUNT.password
            );

            if (dummyResult.success) {
              console.log(
                `      ✅ Đăng nhập dummy thành công - Tránh bị khóa!`
              );
              dummySuccess = true;
              // Reset counter sau khi dummy login thành công
              consecutiveFailedLogins = 0;
              break;
            }
            // Nếu fail lần 1, reload và thử lại
            if (i < 2) {
              await page.goto(config.LOGIN_URL, {
                waitUntil: "networkidle0",
                timeout: config.BROWSER_TIMEOUT,
              });
              await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          if (!dummySuccess) {
            console.log(
              `      ⚠️  Cảnh báo: Không đăng nhập được dummy account`
            );

            // GỬI SYSTEM ERROR WEBHOOK
            console.log(`   🚨 SYSTEM ERROR: Dummy account fail!`);
            await sendSystemErrorWebhook({
              type: "system_error",
              errorType: "dummy_login_failed",
              message: "⚠️ Không thể đăng nhập tài khoản dummy",
              username: username,
              dummyAccount: DUMMY_ACCOUNT.username,
              details: "Tài khoản dummy fail sau 2 lần thử - Có thể bị khóa IP",
              timestamp: new Date().toISOString(),
            });
            // Vẫn reset counter để tránh spam
            consecutiveFailedLogins = 0;
          }
        } else {
          console.log(
            `   ⏭️  Chưa đủ 4 lần sai liên tiếp (${consecutiveFailedLogins}/4), bỏ qua dummy login`
          );
        }

        // Kết thúc vòng lặp, không retry account chính nữa
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
      // Email từ trang MyBusinessInfo (RepresenterEmail)
      const emailInput = document.querySelector(
        'input[name*="RepresenterEmail"]'
      );

      // Email từ trang Thông tin tài khoản (txtUserEmail)
      const userEmailInput = document.querySelector(
        "#ctl00_cplhContainer_txtUserEmail"
      );

      const mobileInput = document.querySelector(
        'input[name*="RepresenterMobile"]'
      );

      return {
        email: emailInput ? emailInput.value : "",
        userEmail: userEmailInput ? userEmailInput.value : "",
        mobile: mobileInput ? mobileInput.value : "",
      };
    });

    // Kết hợp cả 2 emails, ngăn cách bằng dấu ;
    const emails = [];
    if (businessInfo.userEmail && businessInfo.userEmail.trim()) {
      emails.push(businessInfo.userEmail.trim());
    }
    if (businessInfo.email && businessInfo.email.trim()) {
      emails.push(businessInfo.email.trim());
    }

    // Loại bỏ duplicate (nếu 2 emails trùng nhau thì chỉ lấy 1)
    const uniqueEmails = [...new Set(emails)];

    // Kết hợp bằng dấu ; (nếu có 2 emails khác nhau) hoặc chỉ 1 email nếu trùng
    const finalEmail = uniqueEmails.join(", ");

    console.log(
      `   📧 Email từ RepresenterEmail: ${businessInfo.email || "N/A"}`
    );
    console.log(
      `   📧 Email từ txtUserEmail: ${businessInfo.userEmail || "N/A"}`
    );
    console.log(`   📧 Email cuối cùng: ${finalEmail || "N/A"}`);
    console.log(`   📱 Phone: ${businessInfo.mobile || "N/A"}`);

    await page.close();

    return {
      success: true,
      email: finalEmail,
      phone: businessInfo.mobile,
    };
  } catch (error) {
    if (page) await page.close();

    // GỬI SYSTEM ERROR WEBHOOK cho lỗi hệ thống
    console.log(`🚨 SYSTEM ERROR: ${error.message}`);
    await sendSystemErrorWebhook({
      type: "system_error",
      errorType: "browser_crash",
      message: "⚠️ Lỗi hệ thống khi xử lý account",
      username: username,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

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

    // Config cho Render/Railway
    const launchOptions = {
      headless: config.BROWSER_HEADLESS,
      args: config.BROWSER_ARGS,
    };

    // Nếu có env PUPPETEER_EXECUTABLE_PATH (Render set)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    sharedBrowser = await puppeteer.launch(launchOptions);
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
