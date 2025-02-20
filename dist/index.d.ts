interface SiteCheckerConfig {
    resultsFolder?: string;
    batchSize?: number;
    maxConnections?: number;
}
interface NetworkFailure {
    url: string;
    status: number | "blocked";
    resourceType: string;
    initiatingPage: string;
    error?: string;
}
declare class SiteChecker {
    private config;
    private non200Responses;
    private logQueue;
    private writePending;
    constructor(config?: SiteCheckerConfig);
    flushWrites(): Promise<void>;
    ensureResultsFolder(): Promise<void>;
    batchWriter(fileName: string, data: string): Promise<void>;
    fetchAndSplitUrls(sitemapUrl: string): Promise<string[]>;
    checkUrlStatus(urls: string[]): Promise<void>;
    checkPageNetworkRequests(context: any, url: string): Promise<NetworkFailure[]>;
    checkAllNetworkRequests(context: any, urls: string[]): Promise<void>;
}
export { SiteChecker };
export default SiteChecker;
