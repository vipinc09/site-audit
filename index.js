import { parseStringPromise } from "xml2js";
import { promises as fs } from "fs";
import axios from "axios";
import path from "path";

class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.maxConcurrent) {
      this.current++;
      return this.release.bind(this);
    }

    return new Promise((resolve) => this.queue.push(resolve));
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.current++;
      next(this.release.bind(this));
    }
  }
}

class SiteChecker {
  constructor(config = {}) {
    this.config = {
      resultsFolder: path.join(process.cwd(), "test-results"),
      batchSize: 20,
      maxConnections: 50,
      ...config,
    };
    this.non200Responses = [];
    this.logQueue = {};
    this.writePending = false;
  }

  async flushWrites() {
    if (this.writePending) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  async ensureResultsFolder() {
    try {
      await fs.mkdir(this.config.resultsFolder, { recursive: true });
    } catch (error) {
      console.error("Error creating results folder:", error.message);
    }
  }

  async batchWriter(fileName, data) {
    await this.ensureResultsFolder();
    const filePath = path.join(this.config.resultsFolder, fileName);

    try {
      // Append new data instead of overwriting it each time
      await fs.appendFile(filePath, data + "\n", "utf8");
    } catch (error) {
      console.error(`Error writing to ${fileName}:`, error.message);
    }
  }

  async fetchAndSplitUrls(sitemapUrl) {
    try {
      const response = await axios.get(sitemapUrl);
      const result = await parseStringPromise(response.data);

      if (!result.urlset || !result.urlset.url) {
        throw new Error("Invalid sitemap format.");
      }

      const urls = result.urlset.url.map((url) => url.loc[0]);
      console.log(`✅ Total URLs found in sitemap: ${urls.length}`);
      return urls;
    } catch (err) {
      console.error("❌ Error fetching or parsing sitemap:", err.message);
      return [];
    }
  }

  async checkUrlStatus(urls) {
    await this.ensureResultsFolder();
    const http = axios.create({
      maxRedirects: 5,
      timeout: 10000,
      maxContentLength: 50 * 1000 * 1000,
    });

    const errorResponses = []; // Store only 400+ status codes
    const semaphore = new Semaphore(this.config.maxConnections);

    const processUrl = async (url) => {
      const release = await semaphore.acquire();
      try {
        const response = await http.get(url, { validateStatus: () => true });

        if (response.status >= 400) {
          errorResponses.push({ url, status: response.status });
        }
      } catch (err) {
        errorResponses.push({ url, status: "error", error: err.message });
        console.error(`❌ Failed to check ${url}:`, err.message);
      } finally {
        release();
      }
    };

    await Promise.all(urls.map((url) => processUrl(url)));

    // ✅ Write only 400+ errors to JSON at the end
    const filePath = path.join(
      this.config.resultsFolder,
      "non-200-responses.json"
    );
    await fs.writeFile(
      filePath,
      JSON.stringify(errorResponses, null, 2),
      "utf8"
    );
    console.log(`✅ Non-200 responses saved to ${filePath}`);
  }

  async checkPageNetworkRequests(context, url) {
    const page = await context.newPage();
    const failures = [];
    let scrollAttempts = 0;

    page.on("response", (response) => {
      if (response.status() >= 400) {
        failures.push({
          url: response.url(),
          status: response.status(),
          resourceType: response.request().resourceType(),
          initiatingPage: url,
        });
      }
    });

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

      // Auto-scroll implementation
      const autoScroll = async () => {
        await page.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 200);
          });
        });
      };

      while (scrollAttempts < 2) {
        await autoScroll();
        scrollAttempts++;
        await page.waitForTimeout(2000);
      }

      await page.waitForTimeout(5000);
    } catch (error) {
      console.error(`❌ Error processing ${url}:`, error.message);
    } finally {
      await page.close().catch(() => {});
    }

    return failures;
  }

  async checkAllNetworkRequests(context, urls) {
    const allFailures = [];
    const semaphore = new Semaphore(this.config.maxConnections);
    const seenUrls = new Set();

    await Promise.all(
      urls.map(async (url) => {
        const release = await semaphore.acquire();
        try {
          const failures = await this.checkPageNetworkRequests(context, url);
          const uniqueFailures = failures.filter((failure) => {
            const key = `${failure.url}|${failure.status}`;
            if (!seenUrls.has(key)) {
              seenUrls.add(key);
              return true;
            }
            return false;
          });

          allFailures.push(...uniqueFailures);
        } finally {
          release();
        }
      })
    );

    const filePath = path.join(
      this.config.resultsFolder,
      "network-failures.json"
    );
    await fs.writeFile(filePath, JSON.stringify(allFailures, null, 2), "utf8");
    console.log(`✅ Network failures saved to ${filePath}`);
  }
}
export { SiteChecker };
export default SiteChecker;
