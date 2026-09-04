import {
  boolean,
  index,
  integer,
  primaryKey,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    authSubject: text('auth_subject').notNull().unique(),
    email: text('email').notNull(),
    name: text('name'),
    lastLoginAt: text('last_login_at'),
    status: text('status', { enum: ['active', 'suspended'] })
      .notNull()
      .default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_users_email').on(table.email)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    type: text('type', {
      enum: ['platform', 'supplier', 'reseller'],
    }).notNull(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status', {
      enum: ['onboarding', 'active', 'suspended', 'archived'],
    })
      .notNull()
      .default('onboarding'),
    administrativeNotes: text('administrative_notes'),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_organizations_type_status').on(table.type, table.status),
  ],
);

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  scope: text('scope', { enum: ['platform', 'organization'] }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id),
    status: text('status', { enum: ['active', 'invited', 'suspended'] })
      .notNull()
      .default('active'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_members_org_user').on(table.organizationId, table.userId),
    index('idx_members_user_status').on(table.userId, table.status),
  ],
);

export const memberPermissionOverrides = pgTable(
  'member_permission_overrides',
  {
    memberId: text('member_id')
      .notNull()
      .references(() => organizationMembers.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key').notNull(),
    allowed: boolean('allowed').notNull().default(false),
    updatedBy: text('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.permissionKey] })],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id),
    organizationId: text('organization_id').references(() => organizations.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    requestId: text('request_id').notNull(),
    reason: text('reason'),
    metadata: text('metadata'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_org_created').on(table.organizationId, table.createdAt),
    index('idx_audit_entity').on(table.entityType, table.entityId),
  ],
);

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  version: integer('version').notNull().default(1),
  updatedBy: text('updated_by').references(() => users.id),
  updatedAt: text('updated_at').notNull(),
});

export const supplierProfiles = pgTable('supplier_profiles', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  cnpj: text('cnpj').notNull().unique(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name').notNull(),
  stateRegistration: text('state_registration'),
  responsibleName: text('responsible_name').notNull(),
  responsibleCpf: text('responsible_cpf').notNull(),
  responsibleEmail: text('responsible_email').notNull(),
  responsiblePhone: text('responsible_phone').notNull(),
  logoStorageKey: text('logo_storage_key'),
  publicProfileEnabled: boolean('public_profile_enabled')
    .notNull()
    .default(true),
  reputationBasisPoints: integer('reputation_basis_points')
    .notNull()
    .default(10000),
  onboardingStep: integer('onboarding_step').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    emailOperations: boolean('email_operations').notNull().default(true),
    emailOrders: boolean('email_orders').notNull().default(true),
    emailMessages: boolean('email_messages').notNull().default(true),
    emailMarketing: boolean('email_marketing').notNull().default(false),
    browserNotifications: boolean('browser_notifications')
      .notNull()
      .default(true),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.organizationId] })],
);

export const resellerProfiles = pgTable('reseller_profiles', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  personType: text('person_type', { enum: ['individual', 'company'] })
    .notNull()
    .default('individual'),
  cpf: text('cpf').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  avatarStorageKey: text('avatar_storage_key'),
  bankName: text('bank_name'),
  bankBranch: text('bank_branch'),
  bankAccount: text('bank_account'),
  bankAccountType: text('bank_account_type'),
  pixKey: text('pix_key'),
  deactivatedUntil: text('deactivated_until'),
  onboardingStep: integer('onboarding_step').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const addresses = pgTable(
  'addresses',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('primary'),
    postalCode: text('postal_code').notNull(),
    street: text('street').notNull(),
    number: text('number').notNull(),
    complement: text('complement'),
    district: text('district').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').notNull().default('BR'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_addresses_org_type').on(table.organizationId, table.type),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    valueHash: text('value_hash'),
    status: text('status', {
      enum: ['pending', 'verified', 'divergent', 'rejected', 'expired'],
    })
      .notNull()
      .default('pending'),
    source: text('source').notNull(),
    checkedAt: text('checked_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_verifications_org_field').on(
      table.organizationId,
      table.field,
    ),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: text('status', {
      enum: ['pending', 'approved', 'rejected', 'expired'],
    })
      .notNull()
      .default('pending'),
    expiresAt: text('expires_at'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_documents_org_status').on(table.organizationId, table.status),
  ],
);

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: [
      'pending',
      'active',
      'past_due',
      'grace_period',
      'suspended',
      'cancelled',
    ],
  })
    .notNull()
    .default('pending'),
  monthlyAmountCents: integer('monthly_amount_cents').notNull(),
  gracePeriodDays: integer('grace_period_days').notNull(),
  provider: text('provider'),
  externalReference: text('external_reference'),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const supplierFeeExemptions = pgTable(
  'supplier_fee_exemptions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    type: text('type', { enum: ['monthly_fee', 'commission'] }).notNull(),
    status: text('status', { enum: ['active', 'revoked', 'expired'] })
      .notNull()
      .default('active'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at'),
    reason: text('reason').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    revokedBy: text('revoked_by').references(() => users.id),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_fee_exemptions_org_status').on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerMethodToken: text('provider_method_token').notNull(),
    brand: text('brand').notNull(),
    lastFour: text('last_four').notNull(),
    expiryMonth: integer('expiry_month').notNull(),
    expiryYear: integer('expiry_year').notNull(),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_payment_methods_org').on(table.organizationId)],
);

export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id),
    status: text('status', {
      enum: ['pending', 'accepted', 'expired', 'revoked'],
    })
      .notNull()
      .default('pending'),
    tokenHash: text('token_hash'),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: text('expires_at').notNull(),
    acceptedBy: text('accepted_by').references(() => users.id),
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_invitations_org_email').on(
      table.organizationId,
      table.email,
    ),
    uniqueIndex('idx_invitations_token_hash').on(table.tokenHash),
  ],
);

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const categoryAttributes = pgTable(
  'category_attributes',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: text('type').notNull(),
    required: boolean('required').notNull().default(false),
    optionsJson: text('options_json'),
    unit: text('unit'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_category_attribute_key').on(table.categoryId, table.key),
  ],
);
export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id),
    sku: text('sku').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    shortDescription: text('short_description'),
    brand: text('brand'),
    gtin: text('gtin'),
    ncm: text('ncm'),
    netWeightGrams: integer('net_weight_grams'),
    grossWeightGrams: integer('gross_weight_grams'),
    productHeightMm: integer('product_height_mm'),
    productWidthMm: integer('product_width_mm'),
    productLengthMm: integer('product_length_mm'),
    packageHeightMm: integer('package_height_mm'),
    packageWidthMm: integer('package_width_mm'),
    packageLengthMm: integer('package_length_mm'),
    composition: text('composition'),
    voltage: text('voltage'),
    status: text('status').notNull().default('draft'),
    qualityScore: integer('quality_score').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_products_org_sku').on(table.organizationId, table.sku),
    index('idx_products_status_category').on(table.status, table.categoryId),
  ],
);
export const productVariants = pgTable(
  'product_variants',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    gtin: text('gtin'),
    attributesJson: text('attributes_json').notNull().default('{}'),
    priceCents: integer('price_cents').notNull(),
    suggestedRetailCents: integer('suggested_retail_cents'),
    stock: integer('stock').notNull().default(0),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_product_variants_product_sku').on(
      table.productId,
      table.sku,
    ),
    index('idx_product_variants_product_status').on(
      table.productId,
      table.status,
    ),
  ],
);
export const supplierOffers = pgTable('supplier_offers', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .unique()
    .references(() => products.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  priceCents: integer('price_cents').notNull(),
  suggestedRetailCents: integer('suggested_retail_cents'),
  commissionBasisPoints: integer('commission_basis_points').notNull(),
  preparationDays: integer('preparation_days').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: text('attribute_id')
      .notNull()
      .references(() => categoryAttributes.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.attributeId] })],
);
export const productPriceHistory = pgTable(
  'product_price_history',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    priceCents: integer('price_cents').notNull(),
    commissionBasisPoints: integer('commission_basis_points').notNull(),
    effectiveAt: text('effective_at').notNull(),
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index('idx_price_history_product_date').on(
      table.productId,
      table.effectiveAt,
    ),
  ],
);
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    type: text('type').notNull(),
    quantity: integer('quantity').notNull(),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_inventory_product_created').on(table.productId, table.createdAt),
  ],
);

export const productMedia = pgTable(
  'product_media',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    altText: text('alt_text').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_product_media_product_sort').on(
      table.productId,
      table.sortOrder,
    ),
  ],
);
export const importJobs = pgTable(
  'import_jobs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    fileName: text('file_name').notNull(),
    status: text('status').notNull().default('processing'),
    totalRows: integer('total_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    pendingRows: integer('pending_rows').notNull().default(0),
    rejectedRows: integer('rejected_rows').notNull().default(0),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_import_jobs_org_created').on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);
export const importErrors = pgTable(
  'import_errors',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => importJobs.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    columnName: text('column_name').notNull(),
    receivedValue: text('received_value'),
    error: text('error').notNull(),
    recommendation: text('recommendation').notNull(),
  },
  (table) => [
    index('idx_import_errors_job_row').on(table.jobId, table.rowNumber),
  ],
);

export const productFavorites = pgTable(
  'product_favorites',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.productId] })],
);
export const supplierFollowers = pgTable(
  'supplier_followers',
  {
    resellerOrganizationId: text('reseller_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    supplierOrganizationId: text('supplier_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.resellerOrganizationId, table.supplierOrganizationId],
    }),
  ],
);
export const productLists = pgTable(
  'product_lists',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_product_lists_org_name').on(
      table.organizationId,
      table.name,
    ),
  ],
);
export const productListItems = pgTable(
  'product_list_items',
  {
    listId: text('list_id')
      .notNull()
      .references(() => productLists.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.listId, table.productId] })],
);
export const cartItems = pgTable(
  'cart_items',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').references(() => productVariants.id),
    quantity: integer('quantity').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.productId] })],
);
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull().unique(),
    resellerOrganizationId: text('reseller_organization_id')
      .notNull()
      .references(() => organizations.id),
    supplierOrganizationId: text('supplier_organization_id')
      .notNull()
      .references(() => organizations.id),
    status: text('status').notNull(),
    channel: text('channel').notNull(),
    externalReference: text('external_reference'),
    recipientSnapshot: text('recipient_snapshot').notNull(),
    addressSnapshot: text('address_snapshot').notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    commissionCents: integer('commission_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    notes: text('notes'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_orders_reseller_created').on(
      table.resellerOrganizationId,
      table.createdAt,
    ),
    index('idx_orders_supplier_status').on(
      table.supplierOrganizationId,
      table.status,
    ),
  ],
);
export const orderAnomalies = pgTable(
  'order_anomalies',
  {
    id: text('id').primaryKey(),
    resellerOrganizationId: text('reseller_organization_id')
      .notNull()
      .references(() => organizations.id),
    supplierOrganizationId: text('supplier_organization_id').references(
      () => organizations.id,
    ),
    productId: text('product_id').references(() => products.id),
    type: text('type').notNull(),
    requestedQuantity: integer('requested_quantity'),
    availableQuantity: integer('available_quantity'),
    metadata: text('metadata'),
    resolvedAt: text('resolved_at'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_order_anomalies_supplier_created').on(
      table.supplierOrganizationId,
      table.createdAt,
    ),
  ],
);
export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  productSnapshot: text('product_snapshot').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  commissionBasisPoints: integer('commission_basis_points').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
});
export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    variantId: text('variant_id').references(() => productVariants.id),
    quantity: integer('quantity').notNull(),
    status: text('status').notNull().default('active'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    releasedAt: text('released_at'),
  },
  (table) => [
    index('idx_reservations_product_status').on(table.productId, table.status),
  ],
);
export const orderEvents = pgTable(
  'order_events',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    actorUserId: text('actor_user_id').references(() => users.id),
    metadata: text('metadata'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_order_events_order_created').on(table.orderId, table.createdAt),
  ],
);
export const paymentIntents = pgTable('payment_intents', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  provider: text('provider').notNull(),
  externalId: text('external_id').unique(),
  status: text('status').notNull(),
  amountCents: integer('amount_cents').notNull(),
  pixCopyPaste: text('pix_copy_paste'),
  qrStorageKey: text('qr_storage_key'),
  expiresAt: text('expires_at'),
  paidAt: text('paid_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').references(() => orders.id),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    account: text('account').notNull(),
    direction: text('direction').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('BRL'),
    status: text('status').notNull().default('posted'),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    externalReference: text('external_reference'),
    metadata: text('metadata'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_ledger_org_created').on(table.organizationId, table.createdAt),
  ],
);
export const manualExpenses = pgTable(
  'manual_expenses',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    incurredAt: text('incurred_at').notNull(),
    status: text('status').notNull().default('posted'),
    reversedExpenseId: text('reversed_expense_id'),
    reason: text('reason').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_manual_expenses_date').on(table.incurredAt)],
);
export const orderDocuments = pgTable(
  'order_documents',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    number: text('number'),
    issuer: text('issuer').notNull(),
    issuedAt: text('issued_at'),
    storageKey: text('storage_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    quantityCovered: integer('quantity_covered').notNull().default(1),
    barcodeValue: text('barcode_value'),
    status: text('status').notNull().default('pending'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_order_documents_order').on(table.orderId)],
);
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    externalEventId: text('external_event_id').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    status: text('status').notNull(),
    payloadHash: text('payload_hash').notNull(),
    error: text('error'),
    receivedAt: text('received_at').notNull(),
    processedAt: text('processed_at'),
  },
  (table) => [
    uniqueIndex('idx_webhook_provider_event').on(
      table.provider,
      table.externalEventId,
    ),
  ],
);
export const shipments = pgTable(
  'shipments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'cascade' }),
    carrier: text('carrier').notNull(),
    trackingCode: text('tracking_code'),
    status: text('status').notNull().default('preparing'),
    preparationDeadline: text('preparation_deadline').notNull(),
    shippedAt: text('shipped_at'),
    deliveredAt: text('delivered_at'),
    proofStorageKey: text('proof_storage_key'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_shipments_status_deadline').on(
      table.status,
      table.preparationDeadline,
    ),
  ],
);
export const fulfillmentAssignments = pgTable(
  'fulfillment_assignments',
  {
    orderId: text('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => organizationMembers.id),
    assignedBy: text('assigned_by')
      .notNull()
      .references(() => users.id),
    assignedAt: text('assigned_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [index('idx_fulfillment_member').on(table.memberId)],
);
export const trackingEvents = pgTable(
  'tracking_events',
  {
    id: text('id').primaryKey(),
    shipmentId: text('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    status: text('status').notNull(),
    description: text('description').notNull(),
    location: text('location'),
    source: text('source').notNull(),
    occurredAt: text('occurred_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_tracking_shipment_occurred').on(
      table.shipmentId,
      table.occurredAt,
    ),
    uniqueIndex('idx_tracking_shipment_external').on(
      table.shipmentId,
      table.externalId,
    ),
  ],
);
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_notifications_user_read').on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
  ],
);
export const payouts = pgTable(
  'payouts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    status: text('status').notNull().default('pending'),
    grossCents: integer('gross_cents').notNull(),
    feeCents: integer('fee_cents').notNull().default(0),
    netCents: integer('net_cents').notNull(),
    provider: text('provider'),
    externalReference: text('external_reference'),
    scheduledAt: text('scheduled_at'),
    paidAt: text('paid_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_payouts_org_status').on(table.organizationId, table.status),
  ],
);
export const reconciliationRuns = pgTable(
  'reconciliation_runs',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    status: text('status').notNull(),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    expectedCents: integer('expected_cents').notNull(),
    observedCents: integer('observed_cents').notNull(),
    differenceCents: integer('difference_cents').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_reconciliation_period').on(table.periodStart, table.periodEnd),
  ],
);
export const subscriptionEvents = pgTable(
  'subscription_events',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    amountCents: integer('amount_cents'),
    externalReference: text('external_reference'),
    reason: text('reason'),
    occurredAt: text('occurred_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_subscription_events_subscription').on(
      table.subscriptionId,
      table.occurredAt,
    ),
  ],
);
export const supportCases = pgTable(
  'support_cases',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    openedByOrganizationId: text('opened_by_organization_id')
      .notNull()
      .references(() => organizations.id),
    type: text('type').notNull(),
    reason: text('reason').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('open'),
    resolution: text('resolution'),
    mediationRequestedAt: text('mediation_requested_at'),
    resolvedAt: text('resolved_at'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_support_cases_order_status').on(table.orderId, table.status),
  ],
);
export const caseMessages = pgTable(
  'case_messages',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_case_messages_case_created').on(table.caseId, table.createdAt),
  ],
);
export const caseEvidence = pgTable(
  'case_evidence',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_case_evidence_case').on(table.caseId)],
);
export const refunds = pgTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => supportCases.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    amountCents: integer('amount_cents').notNull(),
    status: text('status').notNull().default('approved'),
    provider: text('provider'),
    externalReference: text('external_reference'),
    approvedBy: text('approved_by')
      .notNull()
      .references(() => users.id),
    reason: text('reason').notNull(),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_refunds_order_status').on(table.orderId, table.status),
  ],
);
export const relationshipCredits = pgTable(
  'relationship_credits',
  {
    id: text('id').primaryKey(),
    resellerOrganizationId: text('reseller_organization_id')
      .notNull()
      .references(() => organizations.id),
    supplierOrganizationId: text('supplier_organization_id')
      .notNull()
      .references(() => organizations.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    refundId: text('refund_id')
      .notNull()
      .references(() => refunds.id),
    originalCents: integer('original_cents').notNull(),
    remainingCents: integer('remaining_cents').notNull(),
    status: text('status').notNull().default('available'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_credits_relationship_status').on(
      table.resellerOrganizationId,
      table.supplierOrganizationId,
      table.status,
    ),
  ],
);
export const reputationSnapshots = pgTable(
  'reputation_snapshots',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    scoreBasisPoints: integer('score_basis_points').notNull(),
    componentsJson: text('components_json').notNull(),
    weightsJson: text('weights_json').notNull(),
    sourceWindowStart: text('source_window_start').notNull(),
    sourceWindowEnd: text('source_window_end').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_reputation_org_created').on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id),
    userId: text('user_id').references(() => users.id),
    type: text('type').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    propertiesJson: text('properties_json'),
    occurredAt: text('occurred_at').notNull(),
  },
  (table) => [
    index('idx_analytics_type_occurred').on(table.type, table.occurredAt),
    index('idx_analytics_org_occurred').on(
      table.organizationId,
      table.occurredAt,
    ),
  ],
);
export const riskAssessments = pgTable(
  'risk_assessments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').references(() => orders.id),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    score: integer('score').notNull(),
    decision: text('decision').notNull(),
    signalsJson: text('signals_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_risk_org_created').on(table.organizationId, table.createdAt),
  ],
);
export const dataSubjectRequests = pgTable(
  'data_subject_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    organizationId: text('organization_id').references(() => organizations.id),
    type: text('type').notNull(),
    status: text('status').notNull().default('pending'),
    reason: text('reason'),
    requestedAt: text('requested_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_data_requests_user_status').on(table.userId, table.status),
  ],
);
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);

export const salesChannelConnections = pgTable(
  'sales_channel_connections',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider', {
      enum: ['mercado_livre', 'shopee'],
    }).notNull(),
    externalAccountId: text('external_account_id').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status', {
      enum: ['pending', 'active', 'expired', 'revoked', 'error'],
    })
      .notNull()
      .default('pending'),
    encryptedAccessToken: text('encrypted_access_token'),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: text('token_expires_at'),
    scopesJson: text('scopes_json').notNull().default('[]'),
    settingsJson: text('settings_json').notNull().default('{}'),
    lastSyncedAt: text('last_synced_at'),
    lastError: text('last_error'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_channel_connection_account').on(
      table.provider,
      table.externalAccountId,
    ),
    index('idx_channel_connection_org_status').on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const salesChannelOauthStates = pgTable(
  'sales_channel_oauth_states',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    provider: text('provider').notNull(),
    stateHash: text('state_hash').notNull().unique(),
    returnPath: text('return_path').notNull().default('/integracoes'),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_oauth_state_expiry').on(table.expiresAt)],
);

export const salesChannelListings = pgTable(
  'sales_channel_listings',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => salesChannelConnections.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    productId: text('product_id').references(() => products.id),
    variantId: text('variant_id').references(() => productVariants.id),
    externalListingId: text('external_listing_id'),
    externalVariantId: text('external_variant_id'),
    externalUrl: text('external_url'),
    externalCategoryId: text('external_category_id'),
    externalSku: text('external_sku'),
    status: text('status').notNull().default('draft'),
    pricingMode: text('pricing_mode').notNull().default('margin'),
    marginBasisPoints: integer('margin_basis_points'),
    fixedPriceCents: integer('fixed_price_cents'),
    costSnapshotCents: integer('cost_snapshot_cents'),
    publishedPriceCents: integer('published_price_cents'),
    publishedStock: integer('published_stock').notNull().default(0),
    safetyStock: integer('safety_stock').notNull().default(0),
    validationJson: text('validation_json').notNull().default('[]'),
    lastError: text('last_error'),
    lastSyncedAt: text('last_synced_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_channel_listing_external').on(
      table.connectionId,
      table.externalListingId,
      table.externalVariantId,
    ),
    index('idx_channel_listing_product').on(table.productId, table.variantId),
    index('idx_channel_listing_org_status').on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const salesChannelCategoryMappings = pgTable(
  'sales_channel_category_mappings',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    externalCategoryId: text('external_category_id').notNull(),
    attributesJson: text('attributes_json').notNull().default('{}'),
    updatedBy: text('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_channel_category_mapping').on(
      table.provider,
      table.categoryId,
    ),
  ],
);

export const salesChannelOrderLinks = pgTable(
  'sales_channel_order_links',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => salesChannelConnections.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .unique()
      .references(() => orders.id),
    provider: text('provider').notNull(),
    externalOrderId: text('external_order_id').notNull(),
    externalStatus: text('external_status').notNull(),
    externalSnapshotJson: text('external_snapshot_json').notNull(),
    externalUrl: text('external_url'),
    lastSyncedAt: text('last_synced_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_channel_external_order').on(
      table.provider,
      table.connectionId,
      table.externalOrderId,
    ),
  ],
);

export const salesChannelEvents = pgTable(
  'sales_channel_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    connectionId: text('connection_id').references(
      () => salesChannelConnections.id,
      { onDelete: 'cascade' },
    ),
    externalEventId: text('external_event_id').notNull(),
    type: text('type').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    status: text('status').notNull().default('received'),
    payloadHash: text('payload_hash').notNull(),
    payloadJson: text('payload_json').notNull(),
    error: text('error'),
    receivedAt: text('received_at').notNull(),
    processedAt: text('processed_at'),
  },
  (table) => [
    uniqueIndex('idx_channel_event_provider_external').on(
      table.provider,
      table.externalEventId,
    ),
    index('idx_channel_event_status').on(table.status, table.receivedAt),
  ],
);

export const salesChannelSyncRuns = pgTable(
  'sales_channel_sync_runs',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => salesChannelConnections.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('running'),
    attempted: integer('attempted').notNull().default(0),
    succeeded: integer('succeeded').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    cursor: text('cursor'),
    error: text('error'),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [index('idx_channel_sync_connection').on(table.connectionId)],
);
