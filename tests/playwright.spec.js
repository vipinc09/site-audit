import SiteChecker from "sitemap-audit";
import { test, chromium } from "@playwright/test"; // Note the correct import

const checker = new SiteChecker();

test("Validate and monitor sitemap URLs", async () => {
  test.setTimeout(100000_00);
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const urls = await checker.fetchAndSplitUrls(
    "https://www.example.com/sitemap.xml"
  );

  // Check URL statuses
  await checker.checkUrlStatus(urls);

  // Monitor network requests
  await checker.checkAllNetworkRequests(context, urls);
  await browser.close();
});
