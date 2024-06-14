import { defer, forkJoin, Observable, of, retry, tap } from 'rxjs';
import type { UploadResponse } from '../upload';
import { batchUpload, FileMetadata, FileWithMetadata, upload, UploadStatus } from '../upload';
import type { IErrorResponse, INuclia } from '../../models';
import type {
  Classification,
  CloudLink,
  ExtractedText,
  FIELD_TYPE,
  FileField,
  FileFieldData,
  ICreateResource,
  IFieldData,
  IResource,
  LinkField,
  LinkFieldData,
  Paragraph,
  PositionedNER,
  ResourceData,
  ResourceField,
  Sentence,
  TextField,
  TokenAnnotation,
  UserTokenAnnotation,
} from './resource.models';
import { ExtractedDataTypes, ResourceFieldProperties } from './resource.models';
import type { Ask, ChatOptions, Search, SearchOptions } from '../search';
import { find, search, ask } from '../search';
import { retry429Config, setEntities, setLabels, sliceUnicode } from './resource.helpers';
import { RagStrategyName } from '../kb/kb.models';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReadableResource extends IResource {}

/**
 * Implements all the read operations on resources.
 *
 * A resource allows you to store content in the Knowledge Box.
 * A single resource might contain several fields.
 *
 * Fields have different types: files, links, texts, conversations, etc.
 */
export class ReadableResource implements IResource {
  data: ResourceData = {};
  private fieldTextsCache: { [key: string]: string[] } = {};

  /**
   * Note: Usually you will not need to create a `Resource` object yourself.
   * It is returned by the `getResource` method of the `KnowledgeBox` object. */
  constructor(data: IResource) {
    if (!data.data) {
      data.data = {};
    }
    Object.assign(this, { ...data, title: this.formatTitle(data.title) });
  }

  getFields<T = IFieldData>(types: (keyof ResourceData)[] = ['files', 'links', 'texts']): T[] {
    return Object.entries(this.data)
      .filter(([key]) => types.includes(key as keyof ResourceData))
      .map(([, value]) => value)
      .filter((obj) => !!obj)
      .map((obj) => Object.values(obj!) as T[])
      .reduce((acc, val) => acc.concat(val), [] as T[]);
  }

  getFieldData<T = IFieldData>(type: keyof ResourceData, fieldId: string): T | undefined {
    const field = this.data[type]?.[fieldId];
    return field ? (field as T) : undefined;
  }

  /** Returns the summaries generated by Nuclia for every resource fields. */
  getExtractedSummaries(): string[] {
    return this.getFields()
      .filter((field) => field.extracted?.metadata?.metadata?.summary)
      .map((field) => field.extracted!.metadata!.metadata!.summary!);
  }

  /** Returns the texts generated by Nuclia for every resource fields. */
  getExtractedTexts(): ExtractedText[] {
    return this.getFields()
      .filter((field) => field.extracted?.text)
      .map((field) => field.extracted!.text!);
  }

  /** Returns the files contained in the resource. */
  getFiles(): CloudLink[] {
    return this.getFields<FileFieldData>(['files'])
      .filter((field) => !!field && !!field.value && !!field.value.file)
      .map((field) => (field.value as FileField).file as CloudLink);
  }

  /** Returns the thumbnails generated by Nuclia for every resource fields. */
  getThumbnails(): CloudLink[] {
    return this.getFields<FileFieldData>(['files'])
      .map((field) => field.extracted?.file?.file_thumbnail)
      .concat(this.getFields<LinkFieldData>(['links']).map((field) => field.extracted?.link?.link_thumbnail))
      .filter((thumb) => !!thumb) as CloudLink[];
  }

  getAnnotatedEntities(): { [key: string]: string[] } {
    const entities = (this.fieldmetadata || [])
      .filter((entry) => entry.token && entry.token.length > 0)
      .map((entry) => entry.token as UserTokenAnnotation[]);
    return entities.reduce(
      (acc, val) => {
        val
          .filter((token) => !token.cancelled_by_user)
          .forEach((token) => {
            if (!acc[token.klass]) {
              acc[token.klass] = [];
            }
            acc[token.klass].push(token.token);
          });
        return acc;
      },
      {} as { [key: string]: string[] },
    );
  }

  /** Returns the entities extracted from the resource. */
  getNamedEntities(): { [key: string]: string[] } {
    return this.getFields()
      .filter((field) => field.extracted?.metadata?.metadata?.ner)
      .map((field) =>
        Object.entries(field.extracted!.metadata!.metadata!.ner).reduce(
          (acc, [key, value]) => {
            acc[value] = (acc[value] || []).concat([key]);
            return acc;
          },
          {} as { [key: string]: string[] },
        ),
      )
      .reduce((acc, val) => {
        Object.entries(val).forEach(([key, value]) => {
          acc[key] = (acc[key] || []).concat(value);
        });
        return acc;
      }, {});
  }

  getClassifications(): Classification[] {
    const classifications = (this.usermetadata?.classifications || []).filter((c) => !c.cancelled_by_user);
    const cancellations = (this.usermetadata?.classifications || []).filter((c) => c.cancelled_by_user);
    return (this.computedmetadata?.field_classifications || []).reduce((acc, field) => {
      field.classifications.forEach((classification) => {
        const existing = acc.find((c) => c.label === classification.label && c.labelset === classification.labelset);
        const isCancelled = cancellations.find(
          (c) => c.label === classification.label && c.labelset === classification.labelset,
        );
        if (!existing && !isCancelled) {
          acc.push({ ...classification, immutable: true });
        }
      });
      return acc;
    }, classifications);
  }

  getPositionedNamedEntities(fieldType: keyof ResourceData, fieldId: string): PositionedNER[] {
    const positions = this.data[fieldType]?.[fieldId]?.extracted?.metadata?.metadata.positions;
    if (!positions) {
      return [];
    }
    return Object.entries(positions).reduce((acc, [entityId, data]) => {
      const family = entityId.split('/')[0];
      data.position.forEach((position) => {
        acc.push({ entity: data.entity, family, ...position });
      });
      return acc;
    }, [] as PositionedNER[]);
  }

  private formatTitle(title?: string): string {
    title = title || '–';
    try {
      return decodeURIComponent(title);
    } catch (e) {
      return title;
    }
  }

  getParagraphText(fieldType: FIELD_TYPE, fieldId: string, paragraph: Paragraph): string {
    return sliceUnicode(this.getFieldText(fieldType, fieldId, paragraph.key), paragraph.start, paragraph.end);
  }

  getSentenceText(fieldType: FIELD_TYPE, fieldId: string, sentence: Sentence): string {
    return sliceUnicode(this.getFieldText(fieldType, fieldId, sentence.key), sentence.start, sentence.end);
  }

  private getFieldText(fieldType: FIELD_TYPE, fieldId: string, split?: string): string[] {
    const key = `${fieldType}-${fieldId}` + (split ? `-${split}` : '');
    if (!this.fieldTextsCache[key]) {
      const field = this.getFieldData(`${fieldType}s` as keyof ResourceData, fieldId);
      this.fieldTextsCache[key] = split
        ? Array.from(field?.extracted?.text?.split_text?.[split] || '')
        : Array.from(field?.extracted?.text?.text || '');
    }
    return this.fieldTextsCache[key];
  }
}

/** Extends `ReadableResource` and implements all the write operations. */
export class Resource extends ReadableResource implements IResource {
  kb: string;
  uuid: string;
  private nuclia: INuclia;

  get kbPath(): string {
    return `/kb/${this.kb}`;
  }

  get path(): string {
    if (!this.uuid && !this.slug) {
      throw new Error('Resource must have either uuid or slug');
    }
    return !this.uuid ? `${this.kbPath}/slug/${this.slug}` : `${this.kbPath}/resource/${this.uuid}`;
  }

  constructor(nuclia: INuclia, kb: string, data: IResource) {
    super(data);
    this.nuclia = nuclia;
    this.kb = kb;
    this.uuid = data.id;
  }

  /**
   * Modifies the resource attributes.
   *
   * Example:
    ```ts
    nuclia.db
      .getKnowledgeBox('my-account', 'my-kb')
      .pipe(
        switchMap((knowledgeBox) => knowledgeBox.getResource('my-resource')),
        switchMap((resource) => resource.modify({ description: 'new description' })),
      )
      .subscribe(() => {
        console.log('resource modified');
      });
    ```
   */
  modify(data: Partial<ICreateResource>, synchronous = true): Observable<void> {
    return defer(() => this.nuclia.rest.patch<void>(this.path, data, undefined, undefined, synchronous)).pipe(
      retry(retry429Config()),
    );
  }

  /** Deletes the resource. */
  delete(synchronous = true): Observable<void> {
    return defer(() => this.nuclia.rest.delete(this.path, undefined, synchronous)).pipe(retry(retry429Config()));
  }

  /** Triggers a resource reprocessing. */
  reprocess(): Observable<void> {
    return defer(() => this.nuclia.rest.post<void>(`${this.path}/reprocess`, {}, undefined, undefined, true)).pipe(
      retry(retry429Config()),
    );
  }

  getField(
    type: FIELD_TYPE,
    field: string,
    show: ResourceFieldProperties[] = [ResourceFieldProperties.VALUE],
    extracted: ExtractedDataTypes[] = [
      ExtractedDataTypes.TEXT,
      ExtractedDataTypes.SHORTENED_METADATA,
      ExtractedDataTypes.LINK,
      ExtractedDataTypes.FILE,
    ],
  ): Observable<ResourceField> {
    const params = [...show.map((s) => `show=${s}`), ...extracted.map((e) => `extracted=${e}`)];
    return this.nuclia.rest.get<ResourceField>(`${this.path}/${type}/${field}?${params.join('&')}`);
  }

  /** Returns the thumbnails generated by Nuclia for every resource fields as `blob:` URLs. */
  getThumbnailsUrl(): Observable<string[]> {
    return forkJoin(
      this.getThumbnails()
        .filter((cloudLink) => cloudLink.uri)
        .map((cloudLink) => this.nuclia.rest.getObjectURL(cloudLink.uri as string)),
    );
  }

  /** Deletes the field with the given type and id. */
  deleteField(type: FIELD_TYPE, field: string, synchronous = false): Observable<void> {
    return this.nuclia.rest.delete(`${this.path}/${type}/${field}`, undefined, synchronous);
  }

  /**
   * Adds or updates a field in the resource.
   *
   * Example:
    ```ts
    nuclia.db
      .getKnowledgeBox('my-account', 'my-kb')
      .pipe(
        switchMap((knowledgeBox) =>
          knowledgeBox.getResource('my-resource').pipe(
            switchMap((resource) =>
              resource.setField(FIELD_TYPE.text, 'my-field', {
                body: '*my text*',
                format: 'MARKDOWN',
              }),
            ),
          ),
        ),
      )
      .subscribe(() => {
        console.log('field added');
      });
    ```
  */
  setField(
    type: FIELD_TYPE,
    field: string,
    data: TextField | LinkField | FileField,
  ): Observable<void> {
    return defer(() => this.nuclia.rest.put<void>(`${this.path}/${type}/${field}`, data)).pipe(retry(retry429Config()));
  }

  /**
   * Uploads a file in the resource. The field will be stored in the indicated field.
   *
   * Example:
    ```ts
    nuclia.db
      .getKnowledgeBox('my-account', 'my-kb')
      .pipe(
        switchMap((knowledgeBox) => knowledgeBox.getResource('my-resource')),
        switchMap((resource) => resource.upload(fileInputElement.files[0])),
      )
      .subscribe(() => {
        console.log('file uploaded');
      });
    ```
  */
  upload(field: string, file: File, TUS?: boolean, metadata?: FileMetadata): Observable<UploadResponse>;
  upload(field: string, buffer: ArrayBuffer, TUS?: boolean, metadata?: FileMetadata): Observable<UploadResponse>;
  upload(
    field: string,
    data: File | FileWithMetadata | ArrayBuffer,
    TUS?: boolean,
    metadata?: FileMetadata,
  ): Observable<UploadResponse> {
    return upload(this.nuclia, `${this.path}/file/${field}`, data, !!TUS, metadata);
  }

  /**
   * Uploads a list of files in the resource. It automatically creates a new field for each file (named according to the filename).
   * It uses the [TUS](https://tus.io/) protocol to upload the files. */
  batchUpload(files: FileList | File[]): Observable<UploadStatus> {
    return batchUpload(this.nuclia, this.path, files, true);
  }

  /** Performs a search operation in the resource (similar as `find()` but results are not nested). */
  search(
    query: string,
    features: Search.ResourceFeatures[] = [],
    options?: SearchOptions,
  ): Observable<Search.Results | IErrorResponse> {
    return search(this.nuclia, this.kb, this.path, query, features, options, true);
  }

  /** Performs a find operation in the resource. */
  find(
    query: string,
    features: Search.ResourceFeatures[] = [],
    options?: SearchOptions,
  ): Observable<Search.FindResults | IErrorResponse> {
    return find(
      this.nuclia,
      this.kb,
      this.kbPath,
      query,
      features,
      this.uuid ? { ...options, resource_filters: [this.uuid] } : options,
    );
  }

  /**
   * Retrieves a generative answer for the given query based on
   * the results of a search operation performed on the resource.
   */
  ask(
    query: string,
    context?: Ask.ContextEntry[],
    features?: Ask.Features[],
    options?: ChatOptions,
  ): Observable<Ask.Answer | IErrorResponse>;
  ask(
    query: string,
    context?: Ask.ContextEntry[],
    features?: Ask.Features[],
    options?: ChatOptions,
    callback?: (answer: Ask.Answer | IErrorResponse) => void,
  ): Observable<null>;
  ask(
    query: string,
    context?: Ask.ContextEntry[],
    features?: Ask.Features[],
    options?: ChatOptions,
    callback?: (answer: Ask.Answer | IErrorResponse) => void,
  ): Observable<Ask.Answer | IErrorResponse> | Observable<null> {
    const askRequest = ask(this.nuclia, this.kb, this.path, query, context, features, options);
    if (callback) {
      askRequest.subscribe((response) => callback(response));
      return of(null);
    }
    return askRequest;
  }

  /**
   * Retrieves a generative answer for the given query using the entire resource as context
   * (the resource's text might be shorten if too large).
   */
  askToResource(
    query: string,
    context?: Ask.ContextEntry[],
    features?: Ask.Features[],
    options?: ChatOptions,
  ): Observable<Ask.Answer | IErrorResponse>;
  askToResource(
    query: string,
    context?: Ask.ContextEntry[],
    features?: Ask.Features[],
    options?: ChatOptions,
    callback?: (answer: Ask.Answer | IErrorResponse) => void,
  ): Observable<null>;
  askToResource(
    query: string,
    context?: Ask.ContextEntry[],
    features?: Ask.Features[],
    options?: ChatOptions,
    callback?: (answer: Ask.Answer | IErrorResponse) => void,
  ): Observable<Ask.Answer | IErrorResponse> | Observable<null> {
    options = { ...(options || {}), rag_strategies: [{ name: RagStrategyName.FULL_RESOURCE }] };
    return this.ask(query, context, features, options, callback);
  }

  setLabels(fieldId: string, fieldType: string, paragraphId: string, labels: Classification[]): Observable<void> {
    const fieldmetadata = setLabels(fieldId, fieldType, paragraphId, labels, this.fieldmetadata || []);
    return this.modify({ fieldmetadata }).pipe(tap(() => (this.fieldmetadata = fieldmetadata)));
  }

  setEntities(fieldId: string, fieldType: string, entities: TokenAnnotation[]): Observable<void> {
    const fieldmetadata = setEntities(fieldId, fieldType, entities, this.fieldmetadata || []);
    return this.modify({ fieldmetadata }).pipe(tap(() => (this.fieldmetadata = fieldmetadata)));
  }
}
