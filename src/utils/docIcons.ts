import type { IconKey } from '@/components/ui';
import type { TranslationKey } from '@/i18n';

/** A meaningful icon per document type (instead of one generic receipt icon). */
export const DOC_ICON: Partial<Record<TranslationKey, IconKey>> = {
  docFard: 'record', // فرد  record of rights
  docAgreement: 'agreement', // بیع نامہ  sale agreement
  docNdc: 'certificate', // No-Demand Certificate
  docRegistry: 'deed', // registered transfer / sale deed
  docTaxChallan: 'rupee', // tax challan
  docNaqsha: 'map', // building plan
  docOther: 'document',
};

/** Resolve a document label key to its icon, defaulting to a generic document. */
export const docIcon = (key: TranslationKey): IconKey => DOC_ICON[key] ?? 'document';
