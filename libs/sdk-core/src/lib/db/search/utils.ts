import { type RAGImageStrategy, RagImageStrategyName, RAGStrategy, RagStrategyName } from '../kb';

export function getRAGStrategies(ragStrategies: string): RAGStrategy[] {
  // ragStrategies format example: 'full_resource|3,field_extension|t/field1|f/field2,hierarchy|2'
  if (!ragStrategies) {
    return [];
  }
  const strategies: RAGStrategy[] = ragStrategies
    .split(',')
    .map((strategy) => {
      const [name, ...rest] = strategy.split('|');
      if (name === RagStrategyName.FULL_RESOURCE || name === RagStrategyName.HIERARCHY) {
        return { name, count: parseInt(rest[0], 10) };
      } else if (name === RagStrategyName.FIELD_EXTENSION) {
        return { name, fields: rest };
      } else if (name === RagStrategyName.METADATAS) {
        return { name, types: rest };
      } else {
        console.error(`Unknown RAG strategy: ${name}`);
        return undefined;
      }
    })
    .filter((s) => s) as RAGStrategy[];
  const strategiesNames = strategies.map((s) => s.name);
  if (
    (strategiesNames.includes(RagStrategyName.FIELD_EXTENSION) ||
      strategiesNames.includes(RagStrategyName.HIERARCHY)) &&
    strategiesNames.includes(RagStrategyName.FULL_RESOURCE)
  ) {
    console.error(
      `Incompatible RAG strategies: 'full_resource' strategy is not compatible with 'field_extension' or 'hierarchy'`,
    );
    return [];
  }
  return strategies;
}

export function getRAGImageStrategies(ragImageStrategies: string): RAGImageStrategy[] {
  // ragImageStrategies format example: 'page_image|3,paragraph_image'
  if (!ragImageStrategies) {
    return [];
  }
  const strategies: RAGImageStrategy[] = ragImageStrategies
    .split(',')
    .map((strategy) => {
      const [name, ...rest] = strategy.split('|');
      if (name === RagImageStrategyName.PAGE_IMAGE) {
        return { name, count: parseInt(rest[0], 10) };
      } else if (name === RagImageStrategyName.PARAGRAPH_IMAGE) {
        return { name };
      } else {
        console.error(`Unknown RAG image strategy: ${name}`);
        return undefined;
      }
    })
    .filter((s) => s) as RAGImageStrategy[];
  return strategies as RAGImageStrategy[];
}

export interface WidgetFeatures {
  editLabels?: boolean;
  entityAnnotation?: boolean;
  filter?: boolean;
  navigateToFile?: boolean;
  navigateToLink?: boolean;
  notPublic?: boolean;
  permalink?: boolean;
  relations?: boolean;
  suggestions?: boolean;
  suggestLabels?: boolean;
  autocompleteFromNERs?: boolean;
  displayMetadata?: boolean;
  answers?: boolean;
  hideLogo?: boolean;
  hideResults?: boolean;
  hideThumbnails?: boolean;
  displayFieldList?: boolean;
  knowledgeGraph?: boolean;
  useSynonyms?: boolean;
  autofilter?: boolean;
  noBM25forChat?: boolean;
  citations?: boolean;
  rephrase?: boolean;
  dumpLog?: boolean;
  preferMarkdown?: boolean;
  openNewTab?: boolean;
  orFilterLogic?: boolean;
}