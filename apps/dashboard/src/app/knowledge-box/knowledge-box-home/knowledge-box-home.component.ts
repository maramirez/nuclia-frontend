import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FeaturesService, NavigationService, SDKService, STFTrackingService, ZoneService } from '@flaps/core';
import { AppService, searchResources, STATUS_FACET, UploadService } from '@flaps/common';
import { ChartData, MetricsService } from '../../account/metrics.service';
import { SisModalService } from '@nuclia/sistema';
import { combineLatest, filter, map, Observable, shareReplay, Subject, switchMap, take } from 'rxjs';
import { Counters, IResource, RESOURCE_STATUS, SortField, UsageType } from '@nuclia/core';
import { ModalConfig, OptionModel } from '@guillotinaweb/pastanaga-angular';
import { UsageModalComponent } from './kb-usage/usage-modal.component';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-knowledge-box-home',
  templateUrl: './knowledge-box-home.component.html',
  styleUrls: ['./knowledge-box-home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeBoxHomeComponent implements OnDestroy {
  private unsubscribeAll = new Subject<void>();

  locale: Observable<string> = this.app.currentLocale;
  account = this.sdk.currentAccount;
  currentKb = this.sdk.currentKb;

  isKbAdmin = this.features.isKbAdmin;
  isKbContrib = this.features.isKBContrib;
  isAccountManager = this.features.isAccountManager;

  configuration = this.currentKb.pipe(switchMap((kb) => kb.getConfiguration()));
  endpoint = this.currentKb.pipe(map((kb) => kb.fullpath));
  uid = this.currentKb.pipe(map((kb) => kb.id));
  slug = this.currentKb.pipe(map((kb) => kb.slug));
  zone = combineLatest([this.currentKb, this.zoneService.getZones()]).pipe(
    map(([kb, zones]) => {
      const zone = zones.find((zone) => zone.slug === kb.zone);
      return zone?.title || kb.zone;
    }),
  );
  stateLabel: Observable<string> = this.currentKb.pipe(
    map((kb) => kb.state),
    map((state) => (state ? `dashboard-home.state.${state.toLowerCase()}` : '')),
  );
  counters: Observable<Counters> = this.sdk.counters;

  allChartsData: Observable<Partial<{ [key in UsageType]: ChartData }>> = this.isAccountManager.pipe(
    filter((isManager) => isManager),
    switchMap(() => this.currentKb),
    switchMap((kb) => this.metrics.getUsageCharts(kb.id)),
    takeUntil(this.unsubscribeAll),
    shareReplay(),
  );
  processingChart = this.allChartsData.pipe(map((charts) => charts[UsageType.SLOW_PROCESSING_TIME]));
  searchChart = this.allChartsData.pipe(map((charts) => charts[UsageType.SEARCHES_PERFORMED]));

  searchQueriesCounts = this.isAccountManager.pipe(
    filter((isManager) => isManager),
    switchMap(() => this.currentKb),
    switchMap((kb) => this.metrics.getSearchQueriesCount(kb.id)),
    takeUntil(this.unsubscribeAll),
    shareReplay(),
  );

  kbUrl = combineLatest([this.account, this.currentKb]).pipe(
    map(([account, kb]) => {
      const kbSlug = (this.sdk.nuclia.options.standalone ? kb.id : kb.slug) as string;
      return this.navigationService.getKbUrl(account.slug, kbSlug);
    }),
  );
  canUpgrade = this.features.canUpgrade;

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
    private features: FeaturesService,
    private navigationService: NavigationService,
    private uploadService: UploadService,
    private metrics: MetricsService,
    private modal: SisModalService,
    private zoneService: ZoneService,
  ) {}

  ngOnDestroy() {
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
  }

  copyEndpoint() {
    this.tracking.logEvent('home_page_copy', { data: 'endpoint' });
    this.endpoint.pipe(take(1)).subscribe((endpoint) => this.copyToClipboard('endpoint', endpoint));
  }

  copyUid() {
    this.tracking.logEvent('home_page_copy', { data: 'uid' });
    this.uid.pipe(take(1)).subscribe((uid) => this.copyToClipboard('uid', uid));
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
    this.tracking.logEvent('select_home_chart', { chart: option.value });
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

  trackNavigationFromHome(destination: string) {
    this.tracking.logEvent('navigate_from_home_page', { destination });
  }
}
