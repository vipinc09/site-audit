# 🔗 Sitemap-Audit

A **Node.js** tool for checking URLs from a sitemap, detecting broken links, and monitoring network requests.

## 🚀 Features

- **Sitemap Parsing**: Extracts all URLs from a given XML sitemap.
- **HTTP Status Checking**: Identifies URLs returning **400+ errors**.
- **Network Request Monitoring**: Detects failed network requests on loaded pages.
- **Concurrent Requests**: Uses a **semaphore** to limit concurrent connections.
- **JSON Reports**: Saves results in structured JSON files.

---

## 🛠️ Installation

### **1️⃣ Clone the Repository**

```sh
git clone https://github.com/your-username/link-checker.git
cd link-checker
```

### **2️⃣ Install Dependencies**

```sh
npm install
```

### **3️⃣ Run the Link Checker**

```sh
node index.js
```

---

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

💾 **Output:**  
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
