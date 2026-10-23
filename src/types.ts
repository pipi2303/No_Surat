export type RoleCode = 'SUPER_ADMIN' | 'ADMIN_GA_HRD' | 'STAFF' | 'AUDITOR';
export type LetterCategory = 'OUTGOING' | 'INCOMING' | 'INTERNAL';
export type LetterStatus = 'DRAFT' | 'REGISTERED' | 'CANCELLED';

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface LetterType {
  id: number;
  code: string;
  name: string;
  allowedCategories: string;
  description: string;
  isActive: boolean;
}

export interface LetterClassification {
  id: number;
  code: string;
  name: string;
  confidentialityLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL';
  description: string;
  isActive: boolean;
}

export interface NumberingRule {
  id: number;
  name: string;
  category: 'OUTGOING' | 'INCOMING' | 'INTERNAL' | 'ALL';
  formatTemplate: string;
  scopeType: 'GLOBAL' | 'DEPARTMENT' | 'LETTER_TYPE' | 'DEPT_AND_TYPE';
  resetPeriod: 'YEARLY' | 'MONTHLY' | 'NEVER';
  digitPadding: number;
  separator: string;
  dateSource: string;
  isActive: boolean;
  effectiveDate: string;
}

export interface NumberingCounter {
  id: number;
  counterKey: string;
  ruleId: number;
  scopeKey: string;
  periodYear: number;
  periodMonth: number;
  lastSequence: number;
  updatedAt: string;
}

export interface CompanySettings {
  id: number;
  companyName: string;
  companyCode: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  npwpOrRegNumber: string;
}

export interface LetterAttachment {
  id: number;
  letterId: number;
  fileName: string;
  storedName: string;
  mimeType: string;
  fileSize: number;
  uploadedByName: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: number;
  userUid: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  beforeValueJson: string | null;
  afterValueJson: string | null;
  reason: string | null;
  metadataJson: string | null;
  createdAt: string;
}

export interface LetterRecord {
  id: number;
  letterCode: string;
  category: LetterCategory;
  status: LetterStatus;
  officialNumber: string | null;
  externalOriginalNumber: string | null;
  letterTypeId: number;
  departmentId: number;
  classificationId: number;
  letterDate: string;
  registrationDate: string;
  subject: string;
  sender: string;
  recipient: string;
  destination: string;
  summary: string;
  adminNotes: string;
  numberingRuleId: number | null;
  sequenceNumber: number | null;
  numberingComponentsJson: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  department?: Department | null;
  letterType?: LetterType | null;
  classification?: LetterClassification | null;
  attachments?: LetterAttachment[];
  historyLogs?: AuditLogItem[];
}

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  departmentId: number | null;
  department?: Department | null;
  permissions?: string[];
  isActive: boolean;
  isDemo: boolean;
  lastLoginAt?: string;
}

export interface DemoAccount {
  id: number;
  uid: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  departmentId: number | null;
  departmentName: string;
  departmentCode: string;
  isDemo: boolean;
}
