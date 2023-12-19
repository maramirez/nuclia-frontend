import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { SDKService, STFTrackingService } from '@flaps/core';
import {
  AppService,
  NavigationService,
  openDesktop,
  searchResources,
  STATUS_FACET,
  UploadService,
} from '@flaps/common';
import { MetricsService } from '../../account/metrics.service';
import { SisModalService } from '@nuclia/sistema';
import { combineLatest, map, Observable, shareReplay, switchMap, take } from 'rxjs';
import { Counters, IResource, RESOURCE_STATUS, SortField, StatsType } from '@nuclia/core';
import { UPGRADABLE_ACCOUNT_TYPES } from '../../account/billing/billing.service';
import { ModalConfig, OptionModel } from '@guillotinaweb/pastanaga-angular';
import { UsageModalComponent } from './kb-usage/usage-modal.component';

@Component({
  selector: 'app-knowledge-box-home',
  templateUrl: './knowledge-box-home.component.html',
  styleUrls: ['./knowledge-box-home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeBoxHomeComponent {
  protected readonly openDesktop = openDesktop;

  locale: Observable<string> = this.app.currentLocale;
  account = this.sdk.currentAccount.pipe(shareReplay());
  currentKb = this.sdk.currentKb.pipe(shareReplay());
  configuration = this.currentKb.pipe(switchMap((kb) => kb.getConfiguration()));
  endpoint = this.currentKb.pipe(map((kb) => kb.fullpath));
  uid = this.currentKb.pipe(map((kb) => kb.id));
  slug = this.currentKb.pipe(map((kb) => kb.slug));
  stateLabel: Observable<string> = this.currentKb.pipe(
    map((kb) => kb.state),
    map((state) => (state ? `dashboard-home.state.${state.toLowerCase()}` : '')),
  );
  counters: Observable<Counters> = this.sdk.counters;

  processingChart = this.currentKb.pipe(
    switchMap((kb) => this.metrics.getChartData(StatsType.PROCESSING_TIME, false, kb.id)),
    shareReplay(),
  );
  searchChart = this.currentKb.pipe(
    switchMap((kb) => this.metrics.getChartData(StatsType.SEARCHES, false, kb.id)),
    shareReplay(),
  );
  searchQueriesCounts = this.currentKb.pipe(switchMap((kb) => this.metrics.getSearchQueriesCountForKb(kb.id)));

  isKbAdmin = this.currentKb.pipe(map((kb) => !!kb.admin));
  isKbContrib = this.currentKb.pipe(map((kb) => !!kb.admin || !!kb.contrib));
  kbUrl = this.currentKb.pipe(
    map((kb) => {
      const kbSlug = (this.sdk.nuclia.options.standalone ? kb.id : kb.slug) as string;
      return this.navigationService.getKbUrl(kb.account, kbSlug);
    }),
  );
  isAccountManager = this.account.pipe(
    map((account) => {
      return account.can_manage_account;
    }),
  );
  isDownloadDesktopEnabled = this.tracking.isFeatureEnabled('download-desktop-app');
  canUpgrade = combineLatest([this.isAccountManager, this.account]).pipe(
    map(([isAccountManager, account]) => isAccountManager && UPGRADABLE_ACCOUNT_TYPES.includes(account.type)),
  );

  showLeftColumn = combineLatest([this.canUpgrade, this.isKbContrib]).pipe(
    map(([canUpgrade, canUpload]) => canUpgrade || canUpload),
  );

  lastUploadedResources: Observable<IResource[]> = this.currentKb.pipe(
    switchMap((kb) =>
      searchResources(kb, {
        pageSize: 6,
        sort: { field: SortField.created, order: 'desc' },
        query: '',
        titleOnly: true,
        filters: [],
        page: 0,
        status: RESOURCE_STATUS.PROCESSED,
      }),
    ),
    map((data) => Object.values(data.results.resources || {})),
  );
  pendingResourceCount: Observable<number> = this.currentKb.pipe(
    switchMap(() => this.uploadService.getResourceStatusCount()),
    map((data) => data.fulltext?.facets?.[STATUS_FACET]?.[`${STATUS_FACET}/PENDING`] || 0),
  );
  isChartDropdownOpen = false;

  readonly chartHeight = 232;
  readonly defaultChartOption = new OptionModel({
    id: 'search',
    label: 'metrics.search.title',
    value: 'search',
  });
  currentChart: OptionModel = this.defaultChartOption;
  chartDropdownOptions: OptionModel[] = [
    this.defaultChartOption,
    new OptionModel({ id: 'processing', label: 'metrics.processing.title', value: 'processing' }),
    // FIXME add generative answers option once NUA will support it
    // new OptionModel({ id: 'answers', label: 'metrics.answers.title', value: 'answers' }),
  ];
  clipboardSupported: boolean = !!(navigator.clipboard && navigator.clipboard.writeText);
  copyIcon = {
    endpoint: 'copy',
    uid: 'copy',
    slug: 'copy',
  };

  constructor(
    private app: AppService,
    private sdk: SDKService,
    private cdr: ChangeDetectorRef,
    private tracking: STFTrackingService,
    private navigationService: NavigationService,
    private uploadService: UploadService,
    private metrics: MetricsService,
    private modal: SisModalService,
  ) {}

  copyEndpoint() {
    this.endpoint.pipe(take(1)).subscribe((endpoint) => this.copyToClipboard('endpoint', endpoint));
  }

  copyUid() {
    this.uid.pipe(take(1)).subscribe((uid) => this.copyToClipboard('uid', uid));
  }

  copySlug() {
    this.slug.pipe(take(1)).subscribe((slug) => this.copyToClipboard('slug', slug || ''));
  }

  private copyToClipboard(type: 'endpoint' | 'uid' | 'slug', text: string) {
    navigator.clipboard.writeText(text);
    this.copyIcon = {
      ...this.copyIcon,
      [type]: 'check',
    };
    this.cdr.markForCheck();
    setTimeout(() => {
      this.copyIcon = {
        ...this.copyIcon,
        [type]: 'copy',
      };
      this.cdr.markForCheck();
    }, 1000);
  }

  selectChart(option: OptionModel) {
    this.currentChart = option;
  }

  openFullscreen() {
    this.tracking.logEvent('open_home_chart_fullscreen');
    this.modal.openModal(
      UsageModalComponent,
      new ModalConfig({
        data: {
          processingChart: this.processingChart,
          searchChart: this.searchChart,
          currentChart: this.currentChart,
          chartDropdownOptions: this.chartDropdownOptions,
        },
      }),
    );
  }
}
