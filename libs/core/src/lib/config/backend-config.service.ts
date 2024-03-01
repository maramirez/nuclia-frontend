import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

import { isPlatformBrowser, PlatformLocation } from '@angular/common';
import { AppInitService, EnvironmentConfiguration, StaticEnvironmentConfiguration } from './app.init.service';
import posthog from 'posthog-js';

@Injectable({ providedIn: 'root' })
export class BackendConfigurationService {
  private config: EnvironmentConfiguration;
  staticConf: StaticEnvironmentConfiguration;
  isBrowser = false;

  constructor(
    @Inject('staticEnvironmentConfiguration') private environmentConfiguration: StaticEnvironmentConfiguration,
    private apiConfig: AppInitService,
    public platformLocation: PlatformLocation,
    @Inject(PLATFORM_ID) platformId: any,
  ) {
    this.config = this.apiConfig.getConfig();
    this.staticConf = this.environmentConfiguration;
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser && this.config.backend.posthog_key && this.config.backend.posthog_host) {
      posthog.init(this.config.backend.posthog_key, {
        api_host: this.config.backend.posthog_host,
        autocapture: false,
        capture_pageview: true,
      });
    }
  }

  getAPIURL(): string {
    return this.config.backend.api;
  }

  getAPIOrigin(): string {
    return this.config.backend.apiOrigin || '';
  }

  getOAuthServer(): string {
    return this.config.backend.oauth || this.getAPIOrigin();
  }

  getAppName(): string {
    return this.config.backend.app;
  }

  getRecaptchaKey(): string | undefined {
    return this.config.backend.siteKey;
  }

  getSocialLogin(): boolean {
    return this.staticConf.backend.social_login;
  }

  getBaseAssetUrl(): string | undefined {
    return this.staticConf.base_asset_url;
  }

  getAllowedHostsRedirect(): string[] {
    return this.config.backend.allowed_hosts_redirect || [];
  }

  getNewApi(): boolean {
    return !!this.staticConf.backend.new_api;
  }

  getOAuthLogin(): boolean {
    return !!this.staticConf.backend.oauth_login;
  }

  getLocales(): string[] {
    return this.staticConf.locales || [];
  }

  getVersion(): string {
    return this.config.version;
  }

  getCDN(): string | undefined {
    return this.config.backend?.cdn;
  }

  useRemoteLogin(): boolean {
    return this.config.remoteLogin || false;
  }

  hasPosthog(): boolean {
    return this.isBrowser && !!this.config.backend.posthog_key && !!this.config.backend.posthog_host;
  }
}
