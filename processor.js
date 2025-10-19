// Module xử lý từng account
// Tách riêng để dễ maintain và reuse

const ac = require("@antiadmin/anticaptchaofficial");
const puppeteer = require("puppeteer");
const config = require("./config");

// Biến global để reuse browser (tiết kiệm RAM và thời gian)
let sharedBrowser = null;

// Hàm xử lý 1 account
async function processAccount(username, password) {
  let page = null;

  try {
    // Lấy hoặc tạo browser (reuse browser để tiết kiệm)
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport nhỏ để tiết kiệm RAM
    await page.setViewport({ width: 1280, height: 800 });

    // Bước 1: Đăng nhập
    await page.goto(config.LOGIN_URL, {
      waitUntil: "networkidle0",
      timeout: config.BROWSER_TIMEOUT,
    });
    await page.waitForSelector("#ctl00_cplhContainer_txtLoginName");

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
    const captchaText = await ac.solveImage(captchaBase64, true);

    // Điền form
    await page.type("#ctl00_cplhContainer_txtLoginName", username);
    await page.type("#ctl00_cplhContainer_txtPassword", password);
    await page.type("#ctl00_cplhContainer_txtCaptcha", captchaText);

    // Click đăng nhập
    await page.click("#ctl00_cplhContainer_btnLogin");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Kiểm tra đăng nhập thành công
    const currentURL = page.url();
    if (currentURL.includes("Login.aspx")) {
      await page.close();
      return {
        success: false,
        error: "Tên đăng nhập hoặc mật khẩu không đúng",
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

    // Đóng page
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

// Hàm đóng browser (gọi khi xong hết)
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
