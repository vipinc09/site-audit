import SiteChecker from "sitemap-audit";
import { test, chromium } from "@playwright/test"; // Note the correct import

const checker = new SiteChecker();

test("Validate and monitor sitemap URLs", async () => {
  test.setTimeout(40000_00);
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const urls = await checker.fetchAndSplitUrls(
    "https://www.standuptocancer.org.uk/sitemap.xml"
  );

  // Check URL statuses
  //await checker.checkUrlStatus(urls);

  // Monitor network requests
  await checker.checkAllNetworkRequests(context, urls.slice(0, 20));
  await browser.close();
});
