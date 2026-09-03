import postgres, { type Sql } from "postgres";

type QueryExecutor = Pick<Sql, "unsafe">;

const globalDatabase = globalThis as typeof globalThis & {
  fluboxPostgres?: Sql;
};

function client(): Sql {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL não configurada.");
  globalDatabase.fluboxPostgres ??= postgres(process.env.DATABASE_URL, {
    ssl: "require",
    // Reutilizar o pool é essencial: abrir uma conexão TLS para cada consulta
    // tornava páginas com várias métricas perceptivelmente lentas.
    max: 10,
    prepare: false,
    idle_timeout: 60,
    connect_timeout: 10,
  });
  return globalDatabase.fluboxPostgres;
}

const foldedAliases: Record<string, string> = {
  userid: "userId",
  organizationid: "organizationId",
  organizationtype: "organizationType",
  organizationstatus: "organizationStatus",
  displayname: "displayName",
  rolekey: "roleKey",
  qualityscore: "qualityScore",
  pricecents: "priceCents",
  retailcents: "retailCents",
  totalcents: "totalCents",
  commissioncents: "commissionCents",
  grosscents: "grossCents",
  feecents: "feeCents",
  netcents: "netCents",
  amountcents: "amountCents",
  createdat: "createdAt",
  updatedat: "updatedAt",
  occurredat: "occurredAt",
  scheduledat: "scheduledAt",
  paidat: "paidAt",
  periodend: "periodEnd",
  gracedays: "graceDays",
  itemcount: "itemCount",
  orderid: "orderId",
  productid: "productId",
  supplierid: "supplierId",
  resellerid: "resellerId",
  trackingcode: "trackingCode",
  shipmentstatus: "shipmentStatus",
  fromstatus: "fromStatus",
  tostatus: "toStatus",
  unitprice: "unitPrice",
  externalreference: "externalReference",
  preparationdays: "preparationDays",
  importedrows: "importedRows",
  pendingrows: "pendingRows",
  rejectedrows: "rejectedRows",
  opencases: "openCases",
  productcount: "productCount",
  followercount: "followerCount",
  minprice: "minPrice",
  quantitycovered: "quantityCovered",
  barcodevalue: "barcodeValue",
  totalunits: "totalUnits",
  assignedmemberid: "assignedMemberId",
  assignedname: "assignedName",
  activeassignments: "activeAssignments",
  lastloginat: "lastLoginAt",
  attributesjson: "attributesJson",
  shortdescription: "shortDescription",
  netweightgrams: "netWeightGrams",
  grossweightgrams: "grossWeightGrams",
  productheightmm: "productHeightMm",
  productwidthmm: "productWidthMm",
  productlengthmm: "productLengthMm",
  packageheightmm: "packageHeightMm",
  packagewidthmm: "packageWidthMm",
  packagelengthmm: "packageLengthMm",
  paymentpending: "paymentPending",
  docspending: "docsPending",
  lowstock: "lowStock",
  paidout: "paidOut",
  paymentsuccess: "paymentSuccess",
  shippingsuccess: "shippingSuccess",
  weekcount: "weekCount",
  monthcount: "monthCount",
  failedpayments: "failedPayments",
  incompleteproducts: "incompleteProducts",
  pendingsuppliers: "pendingSuppliers",
  ontime: "onTime",
  variantid: "variantId",
  variantname: "variantName",
  variantsku: "variantSku",
  memberid: "memberId",
  recipientsnapshot: "recipientSnapshot",
  addresssnapshot: "addressSnapshot",
  suppliername: "supplierName",
  resellername: "resellerName",
  pixcopypaste: "pixCopyPaste",
  paymentexpiresat: "paymentExpiresAt",
  paymentprovider: "paymentProvider",
  filename: "fileName",
  alttext: "altText",
  sortorder: "sortOrder",
  avatarurl: "avatarUrl",
  hasavatar: "hasAvatar",
  referencetype: "referenceType",
  referenceid: "referenceId",
};

function normalizeRow<T>(row: Record<string, unknown>): T {
  const normalized: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(row)) {
    normalized[
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    ] ??= value;
    const folded = foldedAliases[key.toLowerCase()];
    if (folded) normalized[folded] = value;
  }
  return normalized as T;
}

function postgresSql(source: string) {
  if (/^\s*PRAGMA\s+/i.test(source)) return "SELECT 1";
  const ignored = /INSERT\s+OR\s+IGNORE/i.test(source);
  let query = source
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(
      /json_extract\(([^,]+),\s*'\$\.([^']+)'\)/gi,
      "($1)::jsonb->>'$2'",
    );
  if (ignored) query = `${query.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  let position = 0;
  return query
    .replace(/\?/g, () => `$${++position}`)
    .replace(
      /\$(\d+) IS NULL/gi,
      (_, index: string) => `$${index}::text IS NULL`,
    );
}

export class PreparedStatement {
  private values: unknown[] = [];
  constructor(private readonly source: string) {}
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async execute(executor?: QueryExecutor) {
    if (executor) {
      return executor.unsafe(postgresSql(this.source), this.values as never[]);
    }
    return client().unsafe(postgresSql(this.source), this.values as never[]);
  }
  async first<T>(): Promise<T | null> {
    const rows = await this.execute();
    return rows[0] ? normalizeRow<T>(rows[0] as Record<string, unknown>) : null;
  }
  async all<T>() {
    const rows = await this.execute();
    return { results: rows.map((row) => normalizeRow<T>(row)) };
  }
  async run() {
    const result = await this.execute();
    return {
      success: true,
      meta: { changes: result.count ?? result.length },
      results: result.map((row) => normalizeRow(row)),
    };
  }
}

class PostgresDatabase {
  prepare(source: string) {
    return new PreparedStatement(source);
  }
  async batch(statements: PreparedStatement[]) {
    const sql = client();
    return sql.begin(async (transaction) => {
      const results = [];
      for (const statement of statements) {
        const result = await statement.execute(
          transaction as unknown as QueryExecutor,
        );
        results.push({
          success: true,
          meta: { changes: result.count ?? result.length },
          results: result.map((row) => normalizeRow(row)),
        });
      }
      return results;
    });
  }
}

const database = new PostgresDatabase();
export function getD1() {
  return database;
}
