import {
  Classification,
  EntityPositions,
  FieldId,
  getDataKeyFromFieldType,
  Paragraph,
  ParagraphClassification,
  Resource,
  UserClassification,
  UserFieldMetadata,
  UserTokenAnnotation,
} from '@nuclia/core';

export type EditResourceView = 'profile' | 'classification' | 'annotation' | 'add-field';

export interface ParagraphWithText extends Paragraph {
  paragraphId: string;
  text: string;
}

export interface ParagraphWithTextAndClassifications extends ParagraphWithText {
  // labels added to the paragraph by the user, as well as cancellation of backend labels
  userClassifications: UserClassification[];
  // labels generated by the backend which weren't cancelled by the user
  generatedClassifications: Classification[];
}

export interface ParagraphWithTextAndAnnotations extends ParagraphWithText {
  annotations: EntityAnnotation[];
  annotatedText: string;
}

export interface EntityGroup {
  id: string;
  title: string;
  color: string;
  custom?: boolean;
  entities: string[];
}

export interface EntityAnnotation extends UserTokenAnnotation {
  family: string;
  immutable?: boolean;
}

export const getParagraphs = (fieldId: FieldId, resource: Resource): Paragraph[] => {
  const dataKey = getDataKeyFromFieldType(fieldId.field_type);
  if (!dataKey || !resource.data[dataKey]) {
    return [];
  }
  return resource.data[dataKey]?.[fieldId.field_id]?.extracted?.metadata?.metadata?.paragraphs || [];
};

export function getFieldMetadataForClassifications(
  field: FieldId,
  paragraphs: ParagraphWithTextAndClassifications[],
  existingEntries: UserFieldMetadata[],
): UserFieldMetadata[] {
  const paragraphClassifications: ParagraphClassification[] = paragraphs
    .map((p) =>
      p.userClassifications.length > 0
        ? {
            key: p.paragraphId,
            classifications: p.userClassifications,
          }
        : null,
    )
    .filter((classification) => !!classification) as ParagraphClassification[];

  let existingField = false;
  const newEntries = existingEntries.map((entry) => {
    if (entry.field.field === field.field_id && entry.field.field_type === field.field_type) {
      existingField = true;
      return {
        ...entry,
        paragraphs: paragraphClassifications,
      };
    } else {
      return entry;
    }
  });

  if (!existingField) {
    newEntries.push({
      field: { field: field.field_id, field_type: field.field_type },
      paragraphs: paragraphClassifications,
    });
  }
  return newEntries;
}

export function getFieldMetadataForAnnotations(
  field: FieldId,
  paragraphs: ParagraphWithTextAndAnnotations[],
  existingEntries: UserFieldMetadata[],
): UserFieldMetadata[] {
  const userToken: UserTokenAnnotation[] = paragraphs
    .filter((paragraph) => paragraph.annotations.length > 0)
    .reduce((tokens, paragraph) => {
      return tokens.concat(
        paragraph.annotations
          .filter((annotation) => !annotation.immutable)
          .map((entityAnnotation) => ({
            token: entityAnnotation.token,
            klass: entityAnnotation.klass,
            start: entityAnnotation.start + (paragraph.start || 0),
            end: entityAnnotation.end + (paragraph.start || 0),
            cancelled_by_user: entityAnnotation.cancelled_by_user,
          })),
      );
    }, [] as UserTokenAnnotation[]);

  let existingField = false;
  const newEntries = existingEntries.map((entry) => {
    if (entry.field.field === field.field_id && entry.field.field_type === field.field_type) {
      existingField = true;
      return {
        ...entry,
        token: userToken,
      };
    } else {
      return entry;
    }
  });

  if (!existingField) {
    newEntries.push({
      field: { field: field.field_id, field_type: field.field_type },
      token: userToken,
    });
  }
  return newEntries;
}

export function addEntitiesToGroups(allGroups: EntityGroup[], entitiesMap: { [key: string]: string[] }) {
  Object.entries(entitiesMap).forEach(([groupId, entities]) => {
    const group = allGroups.find((g) => g.id === groupId);
    if (group) {
      entities.forEach((entity) => {
        if (!group.entities.includes(entity)) {
          group.entities.push(entity);
        }
      });
    }
  });
}

function getGeneratedFieldAnnotations(
  resource: Resource,
  fieldId: FieldId,
  families: EntityGroup[],
): EntityAnnotation[] {
  const dataKey = getDataKeyFromFieldType(fieldId.field_type);
  const annotations: EntityAnnotation[] = [];
  if (dataKey && resource.data[dataKey]) {
    const positions: EntityPositions =
      resource.data[dataKey]?.[fieldId.field_id]?.extracted?.metadata?.metadata.positions || {};
    Object.entries(positions).forEach(([family, entityPosition]) => {
      const familyId = family.split('/')[0];
      const familyTitle = families.find((group) => group.id === familyId)?.title || '';
      entityPosition.position.forEach((position) =>
        annotations.push({
          klass: familyId,
          family: familyTitle,
          token: entityPosition.entity,
          start: position.start,
          end: position.end,
          immutable: true,
        }),
      );
    });
  }
  return annotations;
}

function getUserAnnotations(resource: Resource, fieldId: FieldId, families: EntityGroup[]): EntityAnnotation[] {
  const userFieldMetadata = (resource.fieldmetadata || []).find(
    (userFieldMetadata) =>
      userFieldMetadata.field.field === fieldId.field_id && userFieldMetadata.field.field_type === fieldId.field_type,
  );

  return (userFieldMetadata?.token || []).map((tokenAnnotation) => ({
    ...tokenAnnotation,
    family: families.find((group) => group.id === tokenAnnotation.klass)?.title || '',
  }));
}

export function getAllAnnotations(resource: Resource, fieldId: FieldId, families: EntityGroup[]): EntityAnnotation[] {
  const generatedAnnotations: EntityAnnotation[] = getGeneratedFieldAnnotations(resource, fieldId, families);
  const userAnnotations: EntityAnnotation[] = getUserAnnotations(resource, fieldId, families);

  return userAnnotations.concat(generatedAnnotations);
}

export function isSameAnnotation(a: EntityAnnotation, b: EntityAnnotation) {
  return a.end === b.end && a.start === b.start && a.family === b.family && a.klass === b.klass && a.token === b.token;
}

export function getParagraphAnnotations(allAnnotations: EntityAnnotation[], paragraph: Paragraph) {
  const annotations: EntityAnnotation[] = allAnnotations
    .filter((annotation) => annotation.start >= (paragraph.start || 0) && annotation.end <= (paragraph.end || 0))
    .map((annotation) => ({
      ...annotation,
      start: annotation.start - (paragraph.start || 0),
      end: annotation.end - (paragraph.start || 0),
    }))
    .sort(sortByPosition);
  return annotations;
}

export function sortByPosition(a: EntityAnnotation, b: EntityAnnotation): number {
  if (a.start < b.start) {
    return -1;
  } else if (a.start > b.start) {
    return 1;
  } else {
    return 0;
  }
}

export function getHighlightedAnnotations(allAnnotations: EntityAnnotation[]): EntityAnnotation[] {
  const cancelledAnnotations: EntityAnnotation[] = allAnnotations.filter((annotation) => annotation.cancelled_by_user);
  return allAnnotations.filter(
    (annotation) =>
      !annotation.cancelled_by_user &&
      !cancelledAnnotations.find((cancelledAnnotation) => isSameAnnotation(annotation, cancelledAnnotation)),
  );
}

export function getAnnotatedText(
  paragraphId: string,
  paragraphText: string,
  annotations: EntityAnnotation[],
  selectedFamily?: EntityGroup | null,
): string {
  let textWithMarks = '';
  let currentIndex = 0;
  annotations.forEach((annotation) => {
    let highlightedStyle = '';
    if (selectedFamily?.id === annotation.klass) {
      highlightedStyle = `style="background-color:${selectedFamily.color}"`;
    }
    textWithMarks += `${sliceUnicode(paragraphText, currentIndex, annotation.start)}<mark title="${
      annotation.family
    }" family="${annotation.klass}" start="${annotation.start}" end="${annotation.end}" token="${
      annotation.token
    }" immutable="${annotation.immutable}" ${highlightedStyle} >${sliceUnicode(
      paragraphText,
      annotation.start,
      annotation.end,
    )}</mark>`;
    currentIndex = annotation.end;
  });
  textWithMarks += sliceUnicode(paragraphText, currentIndex);
  return textWithMarks;
}

/**
 * In JavaScript, '🤖'.length is 2, but all positions in API responses are based on Python and in Python len('🤖') is 1.
 * By converting the string to an array, we can get the correct length and slicing becomes consistent with the API
 * (because the array will split the string into characters, no matter how long they are)
 * @param str
 * @param start
 * @param end
 */
export const sliceUnicode = (str: string | string[] | undefined, start?: number, end?: number) => {
  if (!str) {
    return '';
  }
  if (!Array.isArray(str)) {
    str = Array.from(str);
  }
  return str.slice(start, end).join('');
};
