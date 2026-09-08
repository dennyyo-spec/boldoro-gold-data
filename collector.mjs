import { chromium } from "playwright";
import fs from "fs";

const HOME = "https://www.koreagoldx.co.kr/";
const API = "/api/main";
const PREMIUM = 900;

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function validatePrice(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} 가격 오류`);
  }
}

const browser = await chromium.launch({
  headless: false,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--window-size=1365,900"
  ]
});

const context = await browser.newContext({
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  viewport: { width: 1365, height: 900 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  extraHTTPHeaders: {
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
  }
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", {
    get: () => undefined
  });

  Object.defineProperty(navigator, "languages", {
    get: () => ["ko-KR", "ko", "en-US", "en"]
  });

  Object.defineProperty(navigator, "platform", {
    get: () => "Win32"
  });

  window.chrome = window.chrome || {
    runtime: {}
  };
});

const page = await context.newPage();

try {
  console.log("페이지 접속 시작");

  const homeResponse = await page.goto(HOME, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });

  const homeStatus = homeResponse?.status() ?? 0;

  console.log("페이지 응답 상태:", homeStatus);
  console.log("현재 주소:", page.url());

  if (homeStatus >= 400) {
    throw new Error(`페이지 접속 실패 : ${homeStatus}`);
  }

  await page.waitForTimeout(5000);

  let raw = null;

  console.log("페이지 내부 API 직접 호출 시도");

  try {
    raw = await page.evaluate(async (apiPath) => {
      const response = await fetch(apiPath, {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: null
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `API ${response.status}: ${text.slice(0, 300)}`
        );
      }

      return JSON.parse(text);
    }, API);
  }
  catch (firstError) {
    console.log("직접 호출 1차 실패:", firstError.message);

    console.log("페이지 새로고침 후 재시도");

    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: 45000
    });

    await page.waitForTimeout(7000);

    raw = await page.evaluate(async (apiPath) => {
      const response = await fetch(apiPath, {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: null
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `API ${response.status}: ${text.slice(0, 300)}`
        );
      }

      return JSON.parse(text);
    }, API);
  }

  const p = raw?.officialPrice4;

  if (!p) {
    throw new Error("가격 데이터가 없습니다.");
  }

  const base24 = toNumber(p.p_pure);
  const base18 = toNumber(p.p_18k);
  const base14 = toNumber(p.p_14k);

  validatePrice(base24, "24K");
  validatePrice(base18, "18K");
  validatePrice(base14, "14K");

  const output = {
    success: true,
    dateTime: raw.date || p.date || new Date().toISOString(),
    quotation: {
      type: "browser-live-plus900",
      timezone: "Asia/Seoul",
      updateInterval: "10 minutes"
    },
    source: {
      live: true,
      premiumWon: PREMIUM
    },
    official: {
      gold24Sell: base24,
      gold18Sell: base18,
      gold14Sell: base14
    },
    today: {
      gold24: {
        purity: "99.99%",
        customerBuy: toNumber(p.s_pure),
        customerSell: base24 + PREMIUM,
        baseCustomerSell: base24,
        premium: PREMIUM
      },
      gold18: {
        purity: "75%",
        customerBuy: null,
        customerSell: base18 + PREMIUM,
        baseCustomerSell: base18,
        premium: PREMIUM
      },
      gold14: {
        purity: "58.5%",
        customerBuy: null,
        customerSell: base14 + PREMIUM,
        baseCustomerSell: base14,
        premium: PREMIUM
      },
      platinum: {
        purity: "PLATINUM",
        customerBuy: toNumber(p.s_white),
        customerSell: toNumber(p.p_white)
      },
      silver: {
        purity: "SILVER",
        customerBuy: toNumber(p.s_silver),
        customerSell: toNumber(p.p_silver)
      }
    }
  };

  fs.writeFileSync(
    "gold-price.json",
    JSON.stringify(output, null, 2) + "\n",
    "utf8"
  );

  console.log("수집 성공");
  console.log(JSON.stringify(output, null, 2));
}
catch (error) {
  try {
    await page.screenshot({
      path: "gold-error.png",
      fullPage: true
    });
    console.log("오류 화면 저장: gold-error.png");
  } catch (_) {}

  throw error;
}
finally {
  await browser.close();
}
