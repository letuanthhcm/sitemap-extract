export interface SitemapItem {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  sourceSitemap?: string;
}

export interface SitemapIndexInfo {
  loc: string;
  lastmod?: string;
  count?: number;
  status?: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
}

export interface CrawlStats {
  totalLinks: number;
  totalIndexes: number;
  sitemapsScanned: number;
  durationMs: number;
  rootUrl: string;
  isIndex: boolean;
  discoveredFromDomain?: string;
  discoveredSitemaps?: string[];
  recoveryNotice?: string;
}

export interface CrawlOptions {
  filterIndexes?: string;
  includeMetadata?: boolean;
  maxLinks?: number;
  urlFilter?: string;
  urlExclude?: string;
  method?: 'standard' | 'enhanced';
}

export interface DiscoveredSitemap {
  url: string;
  source: 'robots.txt' | 'well-known' | 'common-pattern' | 'feed' | 'wp-api';
  status?: number;
  sampleLinksCount?: number;
  note?: string;
}

export interface DiscoveryResult {
  domain: string;
  sitemaps: DiscoveredSitemap[];
  robotsFound: boolean;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'disabled';

export interface AppUser {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
  crawlsCount?: number;
  createdBy?: string;
}

