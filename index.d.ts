// index.d.ts
declare module "sitemap-audit" {
  import { BrowserContext } from "playwright";
  import { Builder } from "selenium-webdriver";

  export interface SiteCheckerConfig {
    resultsFolder?: string;
    batchSize?: number;
    maxConnections?: number;
  }

  export interface FailureResource {
    url: string;
    status: number;
    resourceType: string;
    initiatingPage: string;
  }

  export interface ErrorResponse {
    url: string;
    status: number | "error";
    error?: string;
  }

  export class Semaphore {
    constructor(maxConcurrent: number);
    acquire(): Promise<() => void>;
    release(): void;
  }

  export class SiteChecker {
    constructor(config?: SiteCheckerConfig);

    flushWrites(): Promise<void>;
    ensureResultsFolder(): Promise<void>;
    batchWriter(fileName: string, data: string): Promise<void>;
    fetchAndSplitUrls(sitemapUrl: string): Promise<string[]>;
    checkUrlStatus(urls: string[]): Promise<void>;
    checkPageNetworkRequests(
      context: BrowserContext | Builder,
      url: string
    ): Promise<FailureResource[]>;
    checkAllNetworkRequests(
      context: BrowserContext | Builder,
      urls: string[]
    ): Promise<void>;
  }

  export default SiteChecker;
}
