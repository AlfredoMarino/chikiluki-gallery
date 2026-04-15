import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  real,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────

export const collectionTypeEnum = pgEnum("collection_type", [
  "album",
  "roll",
  "collection",
]);

export const visibilityEnum = pgEnum("visibility", [
  "private",
  "public",
  "unlisted",
]);

export const orientationEnum = pgEnum("orientation", [
  "landscape",
  "portrait",
  "square",
]);

export const photoMediumEnum = pgEnum("photo_medium", ["digital", "film"]);

export const tagSourceEnum = pgEnum("tag_source", ["manual", "ai"]);

export const aiJobTypeEnum = pgEnum("ai_job_type", [
  "tags",
  "description",
  "embedding",
]);

export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// ─── NextAuth.js tables ──────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    uniqueIndex("provider_account_idx").on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ]
);

// ─── App tables ──────────────────────────────────────────

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    driveFileId: text("drive_file_id").notNull(),
    driveThumbId: text("drive_thumb_id").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    fileSize: integer("file_size").notNull(),
    blurhash: text("blurhash"),
    thumbBase64: text("thumb_base64"),
    orientation: orientationEnum("orientation").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    isPrivate: boolean("is_private").notNull().default(true),
    fileHash: text("file_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    takenAt: timestamp("taken_at", { mode: "date" }),
    // Session / folder metadata (strict convention)
    medium: photoMediumEnum("medium").notNull(),
    sessionYear: integer("session_year").notNull(),
    camera: text("camera").notNull(),
    sessionDate: text("session_date").notNull(),
    sessionFolder: text("session_folder").notNull(),
    sessionSeq: integer("session_seq").notNull(),
    driveFolderId: text("drive_folder_id").notNull(),
    driveThumbFolderId: text("drive_thumb_folder_id").notNull(),
    storedFilename: text("stored_filename").notNull(),
    digitalDescription: text("digital_description"),
    filmStock: text("film_stock"),
    filmIso: integer("film_iso"),
    filmDescriptors: text("film_descriptors"),
  },
  (table) => [
    index("photos_user_idx").on(table.userId),
    uniqueIndex("photos_hash_user_idx").on(table.fileHash, table.userId),
    index("photos_created_idx").on(table.createdAt),
    index("photos_session_folder_idx").on(table.userId, table.sessionFolder),
    index("photos_medium_year_idx").on(
      table.userId,
      table.medium,
      table.sessionYear
    ),
    index("photos_camera_idx").on(table.userId, table.camera),
  ]
);

export const photoSessionCounters = pgTable(
  "photo_session_counters",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionFolder: text("session_folder").notNull(),
    nextSeq: integer("next_seq").notNull().default(1),
    driveFolderId: text("drive_folder_id"),
    driveThumbFolderId: text("drive_thumb_folder_id"),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sessionFolder] }),
  ]
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tags_name_user_idx").on(table.name, table.userId),
  ]
);

export const photoTags = pgTable(
  "photo_tags",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    source: tagSourceEnum("source").notNull().default("manual"),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.photoId, table.tagId] }),
  ]
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    type: collectionTypeEnum("type").notNull().default("album"),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    coverPhotoId: uuid("cover_photo_id").references(() => photos.id, {
      onDelete: "set null",
    }),
    shareToken: uuid("share_token").defaultRandom(),
    rollMetadata: jsonb("roll_metadata").$type<Record<string, unknown>>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("collections_user_idx").on(table.userId),
    uniqueIndex("collections_slug_user_idx").on(table.slug, table.userId),
    uniqueIndex("collections_share_token_idx").on(table.shareToken),
  ]
);

export const collectionPhotos = pgTable(
  "collection_photos",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.photoId] }),
    index("collection_photos_position_idx").on(
      table.collectionId,
      table.position
    ),
  ]
);

export const layoutConfigs = pgTable("layout_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  collectionId: uuid("collection_id")
    .notNull()
    .unique()
    .references(() => collections.id, { onDelete: "cascade" }),
  layoutType: text("layout_type").notNull().default("grid"),
  columnsMobile: integer("columns_mobile").notNull().default(2),
  columnsTablet: integer("columns_tablet").notNull().default(3),
  columnsDesktop: integer("columns_desktop").notNull().default(4),
  gap: integer("gap").notNull().default(8),
  forceOrientation: boolean("force_orientation").notNull().default(false),
  mobileBehavior: jsonb("mobile_behavior")
    .$type<{
      landscapeInPortrait: "stack" | "scroll-horizontal" | "rotate-hint";
      maxPhotosPerRow: number;
    }>()
    .default({ landscapeInPortrait: "stack", maxPhotosPerRow: 1 }),
  photoOverrides: jsonb("photo_overrides")
    .$type<Record<string, { span: number; aspect?: string }>>()
    .default({}),
});

// ─── AI tables (future) ──────────────────────────────────

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    jobType: aiJobTypeEnum("job_type").notNull(),
    status: aiJobStatusEnum("status").notNull().default("pending"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => [
    index("ai_jobs_photo_idx").on(table.photoId),
    index("ai_jobs_status_idx").on(table.status),
  ]
);
