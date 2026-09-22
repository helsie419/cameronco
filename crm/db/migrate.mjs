#!/usr/bin/env node
// Backwards-compatible entry point. Turso/libSQL is now the supported CRM DB.
import "./migrate-turso.mjs";
