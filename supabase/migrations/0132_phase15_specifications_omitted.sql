-- ============================================================================================
-- 0132 — recording that a product deliberately has no published specifications
--
-- WHY A COLUMN RATHER THAN AN ABSENCE. Phase 15's readiness checklist gains a Specifications item,
-- and the phase document is explicit about what it must be satisfied by: "at least one spec row OR
-- a deliberate 'no published specifications' choice, so an owner is never pushed into inventing a
-- value to publish."
--
-- Those two things look identical in the data without this column. A product with no
-- `product_specs` rows is either one nobody has measured yet or one whose maker has decided its
-- dimensions are not a published fact — and the checklist has to tell them apart, because the
-- whole purpose of the item is to force a DECISION rather than a fabrication. Reading the absence
-- of rows as the decision would satisfy the item for every product the moment it is created, which
-- makes the item say nothing; treating the absence as unmet would leave the owner with one way to
-- publish, and it is the way D10 forbids.
--
-- THE FLAG IS NOT A CLAIM ABOUT THE OBJECT. It says "we are not publishing specifications for this
-- piece", not "this piece has no dimensions". Nothing renders it: the public specification block
-- reads `product_specs` and `products.dimensions` and is absent when they are empty, exactly as
-- before, whatever this column says. It exists for the Studio checklist and the audit trail.
--
-- NO TRIGGER TIES IT TO THE ROWS, deliberately. An owner who marks the choice and later adds a
-- specification has changed their mind, not violated an invariant — the checklist is satisfied
-- either way, so there is nothing for a guard to protect and a guard would only refuse a sensible
-- edit. The column carries a decision, and decisions are allowed to be revised.
-- ============================================================================================

alter table products
  add column specifications_omitted boolean not null default false;

comment on column products.specifications_omitted is
  'The owner has deliberately decided this product publishes no specifications. Satisfies the Phase 15 Specifications readiness item without a spec row, so nobody is pushed into inventing a measurement to publish (D10). Renders nowhere.';
