BOLDORO 실시간 금시세 수집기

구조
1. GitHub Actions가 Chromium 브라우저로 시세 페이지를 엽니다.
2. 페이지가 실제로 호출하는 /api/main 응답을 브라우저 안에서 받습니다.
3. 24K / 18K / 14K "내가 팔 때" 값을 읽습니다.
4. 각각 +900원을 계산해서 gold-price.json으로 저장합니다.
5. Cloudflare Worker는 이 JSON을 읽어 기존 홈페이지에 그대로 전달합니다.

중요
- 이 방식은 Cloudflare Worker가 대상 사이트를 직접 호출하지 않습니다.
- 브라우저 자동화가 실제 페이지 안에서 API 응답을 받는 구조입니다.
- 기본 스케줄은 10분마다입니다.
- GitHub Actions의 예약 실행은 정확히 10분마다 보장되지 않고 지연될 수 있습니다.

파일
collector.mjs
package.json
.github/workflows/update-gold-price.yml
worker.js
gold-price.json (첫 실행 후 자동 생성)
