# 🔗 Sitemap-Audit

A **Node.js** solution for auditing website health through sitemap analysis. Designed for SEO audits, broken link detection, and network request monitoring in Playwright, Selenium, and Cypress test environments.

## 🚀 Features

- **🔍 Sitemap Analysis**: - Extract and validate URLs from XML sitemaps
- **🚨 Error Detection**: - Identify 400+ HTTP status codes and network failures
- **⚡ Concurrent Processing**: - Smart semaphore-based request throttling
- **📊 JSON Reporting**: - Structured output for CI/CD integration
- **🌐 Cross-Platform Support**: - Works with Playwright, Selenium & Cypress
- **🔄 Auto-Scroll Simulation**: - Trigger dynamic content loading
- **🔧 Configurable Thresholds**: - Customize batch sizes and connection limits

---

## 📦 Installation

### **1️⃣ Clone the Repository**

```sh
npm install sitemap-audit
```

Peer Dependencies (install as needed):

```sh
npm install playwright
```

## ⚙️ Configuration

You can modify the configuration in `index.js` or pass values via environment variables.

| Option           | Default Value | Description                          |
| ---------------- | ------------- | ------------------------------------ |
| `resultsFolder`  | "results"     | Folder where JSON reports are saved. |
| `batchSize`      | `20`          | Number of URLs processed at a time.  |
| `maxConnections` | `50`          | Max concurrent HTTP requests.        |

---

## 📌 Usage

### **1️⃣ Checking URLs from a Sitemap**

To check for **400+ HTTP errors**, using playwright refer to the below example:

```js
import SiteChecker from "sitemap-audit";
import { test, chromium } from "@playwright/test";

const checker = new SiteChecker();

test("Validate and monitor sitemap URLs", async () => {
  test.setTimeout(40000_00); // Provide timeout only if the amount of urls being checked is greater than 200
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Generate urls from the sitemap.xml
  const urls = await checker.fetchAndSplitUrls(
    "https://example.com/sitemap.xml"
  );

  // Check URL statuses
  await checker.checkUrlStatus(urls);

  // Monitor network requests
  await checker.checkAllNetworkRequests(context, urls.slice(0, 20));
  await browser.close();
});
```

# 💾 Output Structure:

Results are saved in `results/non-200-responses.json` and `results/network-failures.json`.

`results/non-200-responses.json` would be save in the following format

```
[
  { "url": "https://example.com/about", "status": 404 },
  { "url": "https://example.com/safety", "status": 500 }
]
```

`results/network-failures.json` would be save in the following format

```
[
  {
    "url": "https://example.com/sites/default/files/downloadable_test_pack.pdf?",
    "status": 403,
    "resourceType": "fetch",
    "initiatingPage": "https://example.com/test"
  }
]
```

# 📚 API Reference:

```js
fetchAndSplitUrls(sitemapUrl: string): Promise<string[]>
```

- Fetches and parses sitemap XML
- Returns array of validated URLs

```js
checkUrlStatus(urls: string[]): Promise<void>
```

- Checks HTTP status codes for URLs
- Saves results to non-200-responses.json

```js
checkAllNetworkRequests(context: BrowserContext, urls: string[]): Promise<void>
```

- Analyzes network requests during page loads
- Saves resource failures to network-failures.json

# 🚨 Troubleshooting\*\*

**Common Issues:**

Missing Dependencies: Ensure required browsers drivers are installed

```sh
npm install playwright
```

Timeout Errors: Increase test timeout for large sitemaps

```js
test.setTimeout(120000); // 2-minute timeout
```

# 🤝 Contributing

Pull requests welcome! Please follow:

- Create feature branch from main
- Include test coverage
- Update documentation

# 📄 License

MIT © Vipin Cheruvallil

For detailed implementation examples and issue tracking, visit our [GitHub Repository](https://github.com/vipinc09/site-audit).
