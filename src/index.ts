import { parseStringPromise } from "xml2js";
import { promises as fs } from "fs";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import path from "path";

// Interface for Semaphore configuration
interface SemaphoreConfig {
  maxConcurrent: number;
}

// Interface for SiteChecker configuration
interface SiteCheckerConfig {
  resultsFolder?: string;
  batchSize?: number;
  maxConnections?: number;
}

// Interface for URL status response
interface UrlStatus {
  url: string;
  status: number | "error";
  error?: string;
}

// Interface for network failure response
interface NetworkFailure {
  url: string;
  status: number | "blocked"; // Updated to include 'blocked' status
  resourceType: string;
  initiatingPage: string;
  error?: string; // Added to capture error messages
}

// Semaphore class with TypeScript types
class Semaphore {
  private maxConcurrent: number;
  private current: number;
  private queue: Array<(release: () => void) => void>;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire(): Promise<() => void> {
    if (this.current < this.maxConcurrent) {
      this.current++;
      return this.release.bind(this);
    }

    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.current++;
        next(this.release.bind(this));
      }
    }
  }
}

// SiteChecker class with TypeScript types
class SiteChecker {
  private config: Required<SiteCheckerConfig>;
  private non200Responses: UrlStatus[];
  private logQueue: Record<string, string[]>;
  private writePending: boolean;

  constructor(config: SiteCheckerConfig = {}) {
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

  async flushWrites(): Promise<void> {
    if (this.writePending) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  async ensureResultsFolder(): Promise<void> {
    try {
      await fs.mkdir(this.config.resultsFolder, { recursive: true });
    } catch (error: any) {
      console.error("Error creating results folder:", error.message);
    }
  }

  async batchWriter(fileName: string, data: string): Promise<void> {
    await this.ensureResultsFolder();
    const filePath = path.join(this.config.resultsFolder, fileName);

    try {
      await fs.appendFile(filePath, data + "\n", "utf8");
    } catch (error: any) {
      console.error(`Error writing to ${fileName}:`, error.message);
    }
  }

  async fetchAndSplitUrls(sitemapUrl: string): Promise<string[]> {
    try {
      const response = await axios.get(sitemapUrl);
      const result = await parseStringPromise(response.data);

      if (!result.urlset || !result.urlset.url) {
        throw new Error("Invalid sitemap format.");
      }

      const urls = result.urlset.url.map((url: any) => url.loc[0]);
      console.log(`✅ Total URLs found in sitemap: ${urls.length}`);
      return urls;
    } catch (err: any) {
      console.error("❌ Error fetching or parsing sitemap:", err.message);
      return [];
    }
  }

  async checkUrlStatus(urls: string[]): Promise<void> {
    await this.ensureResultsFolder();
    const http: AxiosInstance = axios.create({
      maxRedirects: 5,
      timeout: 10000,
      maxContentLength: 50 * 1000 * 1000,
    });

    const errorResponses: UrlStatus[] = [];
    const semaphore = new Semaphore(this.config.maxConnections);

    const processUrl = async (url: string): Promise<void> => {
      const release = await semaphore.acquire();
      try {
        const response: AxiosResponse = await http.get(url, {
          validateStatus: () => true,
        });

        if (response.status >= 400) {
          errorResponses.push({ url, status: response.status });
        }
      } catch (err: any) {
        errorResponses.push({ url, status: "error", error: err.message });
        console.error(`❌ Failed to check ${url}:`, err.message);
      } finally {
        release();
      }
    };

    await Promise.all(urls.map((url) => processUrl(url)));

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

  async checkPageNetworkRequests(
    context: any,
    url: string
  ): Promise<NetworkFailure[]> {
    const page = await context.newPage();
    const failures: NetworkFailure[] = [];
    let scrollAttempts = 0;

    // Capture failed requests (including ORB errors)
    page.on("requestfailed", (request: any) => {
      const failureUrl = request.url();
      const failureError = request.failure()?.errorText || "Unknown error";

      // Check if the error is ORB-related
      if (failureError) {
        failures.push({
          url: failureUrl,
          status: "blocked",
          resourceType: request.resourceType(),
          initiatingPage: url,
          error: failureError,
        });
      }
    });

    // Capture non-200 responses
    page.on("response", (response: any) => {
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
      const autoScroll = async (): Promise<void> => {
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
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
    } catch (error: any) {
      console.error(`❌ Error processing ${url}:`, error.message);
    } finally {
      await page.close().catch(() => {});
    }

    return failures;
  }

  async checkAllNetworkRequests(context: any, urls: string[]): Promise<void> {
    const allFailures: NetworkFailure[] = [];
    const semaphore = new Semaphore(this.config.maxConnections);
    const seenUrls = new Set<string>();

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
