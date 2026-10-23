import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users table (uses Firebase Auth UID or Demo Account UID as unique identifier)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull().default(''),
  roleCode: text('role_code').notNull().default('STAFF'), // SUPER_ADMIN | ADMIN_GA_HRD | STAFF | AUDITOR
  departmentId: integer('department_id'),
  isActive: boolean('is_active').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(false),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 2. Roles table
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // SUPER_ADMIN | ADMIN_GA_HRD | STAFF | AUDITOR
  name: text('name').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Permissions table
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  module: text('module').notNull(),
  roleCodes: text('role_codes').notNull(), // JSON array of role codes
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. User Roles junction table
export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  roleId: integer('role_id').notNull(),
  assignedAt: timestamp('assigned_at').defaultNow(),
});

// 5. Departments table
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // HRD, GA, FIN, IT, LEGAL, OPS
  name: text('name').notNull(),
  description: text('description').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 6. Letter Types table
export const letterTypes = pgTable('letter_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // SK, ST, UND, SP, SKET, SPH, SE, MEMO, BA, SM
  name: text('name').notNull(),
  allowedCategories: text('allowed_categories').notNull(), // e.g. "OUTGOING,INTERNAL"
  description: text('description').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 7. Letter Classifications table
export const letterClassifications = pgTable('letter_classifications', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // BIASA, INTERNAL, RAHASIA, SANGAT_RAHASIA
  name: text('name').notNull(),
  confidentialityLevel: text('confidentiality_level').notNull(), // PUBLIC | INTERNAL | CONFIDENTIAL | STRICTLY_CONFIDENTIAL
  description: text('description').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 8. Numbering Rules table
export const numberingRules = pgTable('numbering_rules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // OUTGOING | INCOMING | INTERNAL | ALL
  formatTemplate: text('format_template').notNull(), // e.g. "{SEQ}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}"
  scopeType: text('scope_type').notNull(), // GLOBAL | DEPARTMENT | LETTER_TYPE | DEPT_AND_TYPE
  resetPeriod: text('reset_period').notNull(), // YEARLY | MONTHLY | NEVER
  digitPadding: integer('digit_padding').notNull().default(3),
  separator: text('separator').notNull().default('/'),
  dateSource: text('date_source').notNull().default('LETTER_DATE'), // Always LETTER_DATE per confirmed requirement
  isActive: boolean('is_active').notNull().default(true),
  effectiveDate: text('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 9. Numbering Counters table (concurrency-safe sequence locks)
export const numberingCounters = pgTable('numbering_counters', {
  id: serial('id').primaryKey(),
  counterKey: text('counter_key').notNull().unique(), // Composite lock key: `${ruleId}:${scopeKey}:${periodYear}:${periodMonth}`
  ruleId: integer('rule_id').notNull(),
  scopeKey: text('scope_key').notNull(),
  periodYear: integer('period_year').notNull(),
  periodMonth: integer('period_month').notNull(),
  lastSequence: integer('last_sequence').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 10. Letters table (STRICTLY NO APPROVAL STATUSES: only DRAFT | REGISTERED | CANCELLED)
export const letters = pgTable('letters', {
  id: serial('id').primaryKey(),
  letterCode: text('letter_code').notNull().unique(), // Internal system registry ID e.g. REG-2026-0001
  category: text('category').notNull(), // OUTGOING | INCOMING | INTERNAL
  status: text('status').notNull().default('DRAFT'), // DRAFT | REGISTERED | CANCELLED
  officialNumber: text('official_number').unique(), // Official allocated number (unique, null only for DRAFT)
  externalOriginalNumber: text('external_original_number'), // Original sender's letter number for INCOMING letters
  letterTypeId: integer('letter_type_id').notNull(),
  departmentId: integer('department_id').notNull(),
  classificationId: integer('classification_id').notNull(),
  letterDate: text('letter_date').notNull(), // YYYY-MM-DD (base for month/year numbering)
  registrationDate: text('registration_date').notNull(), // YYYY-MM-DD
  subject: text('subject').notNull(),
  sender: text('sender').notNull(),
  recipient: text('recipient').notNull(),
  destination: text('destination').notNull(),
  summary: text('summary').notNull(),
  adminNotes: text('admin_notes').notNull().default(''),
  numberingRuleId: integer('numbering_rule_id'),
  sequenceNumber: integer('sequence_number'),
  numberingComponentsJson: text('numbering_components_json'), // Historical snapshot of numbering tokens
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: text('cancelled_by'),
  cancellationReason: text('cancellation_reason'),
  createdByUid: text('created_by_uid').notNull(),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 11. Letter Attachments table
export const letterAttachments = pgTable('letter_attachments', {
  id: serial('id').primaryKey(),
  letterId: integer('letter_id').notNull(),
  fileName: text('file_name').notNull(),
  storedName: text('stored_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedByName: text('uploaded_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 12. Audit Logs table (Immutable append-only activity ledger)
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  description: text('description').notNull(),
  beforeValueJson: text('before_value_json'),
  afterValueJson: text('after_value_json'),
  reason: text('reason'),
  metadataJson: text('metadata_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 13. Company Settings table
export const companySettings = pgTable('company_settings', {
  id: serial('id').primaryKey(),
  companyName: text('company_name').notNull(),
  companyCode: text('company_code').notNull(),
  logoUrl: text('logo_url').notNull().default(''),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  website: text('website').notNull(),
  npwpOrRegNumber: text('npwp_or_reg_number').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const lettersRelations = relations(letters, ({ one, many }) => ({
  department: one(departments, {
    fields: [letters.departmentId],
    references: [departments.id],
  }),
  letterType: one(letterTypes, {
    fields: [letters.letterTypeId],
    references: [letterTypes.id],
  }),
  classification: one(letterClassifications, {
    fields: [letters.classificationId],
    references: [letterClassifications.id],
  }),
  numberingRule: one(numberingRules, {
    fields: [letters.numberingRuleId],
    references: [numberingRules.id],
  }),
  attachments: many(letterAttachments),
}));

export const letterAttachmentsRelations = relations(letterAttachments, ({ one }) => ({
  letter: one(letters, {
    fields: [letterAttachments.letterId],
    references: [letters.id],
  }),
}));
