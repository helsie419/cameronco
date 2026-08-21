-- Stock/inventory ledger — loose stones, raw metal, ring mounts/configurations,
-- and finished pre-made pieces. Lets an assessor see, while quoting, whether
-- a matching item is already on hand or needs to be ordered.
--
-- category-specific matching fields (stone type/shape/carat/quality, metal
-- type/colour, mount category/style) live in `attributes` JSONB rather than
-- a wide set of mostly-null typed columns, since only one category's fields
-- are ever populated per row. Matching queries use the same lookup codes
-- (stone_type, stone_shape, stone_quality, metal_type, metal_colour,
-- item_category, ring_style) already used on claim_items / item_stones, so
-- a stock row can be matched directly against what's typed into a quote.
--
-- Deliberately does NOT auto-deduct when used in a quote — a quote is a
-- proposal, not a commitment. Quantity only changes via a deliberate edit.

BEGIN;

CREATE TABLE stock_items (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category          TEXT NOT NULL CHECK (category IN ('stone','metal','mount','finished')),
    description       TEXT NOT NULL,
    sku               TEXT,
    quantity          NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit              TEXT NOT NULL DEFAULT 'pc' CHECK (unit IN ('pc','gm','ct')),
    reorder_threshold NUMERIC(12,3) NOT NULL DEFAULT 0,
    supplier          TEXT,
    cost              NUMERIC(12,2),
    suggested_rrp     NUMERIC(12,2),
    attributes        JSONB NOT NULL DEFAULT '{}',
    notes             TEXT,
    branch            TEXT NOT NULL DEFAULT 'melbourne' CHECK (branch IN ('melbourne','sydney')),
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_items_category ON stock_items (category) WHERE active;
CREATE INDEX idx_stock_items_attributes ON stock_items USING GIN (attributes);

CREATE TRIGGER trg_stock_items_touch BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
