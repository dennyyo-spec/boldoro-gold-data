import { chromium } from "playwright";
import fs from "fs";

const HOME = "https://www.koreagoldx.co.kr/";
const API_PATH = "/api/main";
const PREMIUM = 900;

function n(v) {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? Math.round(x) : null;
}

const browser = await chromium.launch({
  headless: true
});

const context = await browser.newContext({
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
});

const page = await context.newPage();

try {
  const responsePromise = page.waitForResponse(
    response =>
      response.url().includes(API_PATH) &&
      response.request().method() === "POST" &&
      response.status() === 200,
    { timeout: 30000 }
  );

  await page.goto(HOME, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const response = await responsePromise;
  const raw = await response.json();
  const p = raw?.officialPrice4;

  if (!p) {
    throw new Error("가격 데이터가 없습니다.");
  }

  const base24 = n(p.p_pure);
  const base18 = n(p.p_18k);
  const base14 = n(p.p_14k);

  if (![base24, base18, base14].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error("24K/18K/14K 가격 값이 올바르지 않습니다.");
  }

  const output = {
    success: true,
    dateTime: raw.date || p.date || new Date().toISOString(),
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
        customerBuy: n(p.s_pure),
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
        customerBuy: n(p.s_white),
        customerSell: n(p.p_white)
      },
      silver: {
        purity: "SILVER",
        customerBuy: n(p.s_silver),
        customerSell: n(p.p_silver)
      }
    }
  };

  fs.writeFileSync(
    "gold-price.json",
    JSON.stringify(output, null, 2) + "\n",
    "utf8"
  );

  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}
