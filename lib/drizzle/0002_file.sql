CREATE TABLE IF NOT EXIST "File" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "url" varchar(64) NOT NULL,
    "name" varchar(255) NOT NULL,
    "mimeType" varchar(64) NOT NULL,
    "googleFileUri" varchar(255),
    "googleExpiresAt" TIMESTAMP WITHOUT TIME ZONE,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    CONSTRAINT File_pkey primary key ("id")
);