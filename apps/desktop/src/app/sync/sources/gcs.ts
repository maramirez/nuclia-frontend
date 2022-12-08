import {
  ConnectorSettings,
  ISourceConnector,
  SourceConnectorDefinition,
  SyncItem,
  SearchResults,
  ConnectorParameters,
  Field,
  FileStatus,
} from '../models';
import { Observable, of, from, switchMap, map } from 'rxjs';
import { GoogleBaseImpl } from './google.base';

const BUCKET_KEY = 'GCS_BUCKET';

const MAX_PAGE_SIZE = 1000;

export const GCSConnector: SourceConnectorDefinition = {
  id: 'gcs',
  title: 'Google Cloud',
  logo: 'assets/logos/gcs.svg',
  description: 'File storage service developed by Google',
  factory: (data?: ConnectorSettings) => of(new GCSImpl(data)),
};

class GCSImpl extends GoogleBaseImpl implements ISourceConnector {
  override DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/storage/v1/rest'];
  isExternal = false;
  resumable = false;

  constructor(data?: ConnectorSettings) {
    super(data);
  }

  getParameters(): Observable<Field[]> {
    return of([
      {
        id: 'bucket',
        label: 'Bucket',
        type: 'text',
        required: true,
      },
    ]);
  }

  handleParameters(params: ConnectorParameters) {
    localStorage.setItem(BUCKET_KEY, params.bucket);
  }

  getFiles(query?: string, pageSize?: number): Observable<SearchResults> {
    if (query) {
      // GCS API doesn't have any command to filter by keywords.
      // As a workaround we retrieve all the objects and do the filtering ourselves.
      pageSize = MAX_PAGE_SIZE;
    }
    return this._getFiles(query, pageSize);
  }

  private _getFiles(query?: string, pageSize: number = 50, nextPage?: string | number): Observable<SearchResults> {
    const regexp = query ? new RegExp(`(${query})`, 'i') : null;
    const bucket = localStorage.getItem(BUCKET_KEY);
    if (!bucket) {
      return of({ items: [] as SyncItem[] });
    } else {
      return from(
        fetch(
          `https://storage.googleapis.com/storage/v1/b/${bucket}/o?maxResults=${pageSize}&pageToken=${nextPage || ''}`,
          {
            headers: { Authorization: 'Bearer ' + localStorage.getItem(this.TOKEN) },
          },
        ),
      ).pipe(
        switchMap((res) => res.json()),
        map((res) => ({
          items: (res.items as any[]).map(this.mapResult).filter((item) => !regexp || regexp.test(item.title)),
          nextPage: res.nextPageToken ? this._getFiles(query, pageSize, res.nextPageToken) : undefined,
        })),
      );
    }
  }

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  private mapResult(result: any): SyncItem {
    return {
      originalId: result.id,
      title: result.name,
      uuid: '',
      metadata: {
        mediaLink: result.mediaLink,
      },
      status: FileStatus.PENDING,
    };
  }

  download(resource: SyncItem): Observable<Blob> {
    return from(
      fetch(resource.metadata.mediaLink, { headers: { Authorization: 'Bearer ' + localStorage.getItem(this.TOKEN) } }),
    ).pipe(switchMap((res) => res.blob()));
  }
}