# SKANARE shared T-shirt inventory — rollout

This change introduces a **deliberate activation gate**. Deploying code alone does not alter the inventory used by live orders. Legacy accessories/keychains keep their separate variant stock.

## First activation
1. Open Admin → Inventory & Production. Review physical quantities: for **each** White and Black color, S=2, M=4, L=6, XL=3, 2XL=0, only if still true at activation. If sales have already occurred, do a fresh physical count.
2. Initialize blank inventory **once**, while the switch remains OFF. It does not deduct, replenish, or migrate any historical orders.
3. Set an extra selling capacity for each color/size; zero is the safe default. Backorders require realistic lead-time messaging to customers before enabling nonzero capacity.
4. Wait until old carts and pending checkouts have no active holds, then activate shared stock explicitly. This operation cannot be silently reversed after paid orders.
5. Verify all T-shirt designs share the same availability for a given color/size; NFC products must not change.

## Operational meaning
- `onHand`: physically present blanks including paid allocations not yet placed in production.
- `committedPhysical`: physically present but committed to paid orders.
- `virtualLimit`: maximum outstanding orders that can wait for purchasing.
- `backorderOpen`: number of paid, unfulfilled virtual allocations.
- `physicalAvailable = onHand - committedPhysical`.
- `sellable = physicalAvailable + virtualLimit - backorderOpen - live cart/checkout holds`.
- Physical blanks are committed at payment confirmation and consumed when production starts.
- For a virtual order, receive blanks then click **Allocate blank** for that production job; the receipt alone does not mark a backorder fulfilled.
- DTF and QR transfers are **not** additional T-shirts. Each unique QR is assigned once to one order, and physical DTF parts are tracked separately.

## Critical checks before activation
- No old active holds (backend enforces this).
- Active pending Viva payments/orders: review and resolve them before switching; the hold check does not guarantee no payment race.
- Physically count blank stock; don't infer it from legacy `variants[].stock`.
- Test with a real low-value order and refund process only after confirming payments and refunds are appropriately handled.
- Compare paid-order production requirements with actual materials. A printed QR file is not necessarily a physically received transfer.

## Known current scope
- Production jobs for shared-blank paid T-shirt orders; the existing fulfillment order flow remains.
- Finished stock creation for unsolicited preprinted garments is not migrated by this feature; do not count finished garments as blanks.
- The QR-only inventory overview is informational; status comes from `qrCodes`.
- Do not use manual stock adjustment to reverse cancelled or damaged orders; reconcile through documented inventory movements.
