import { getDB, toPlainDocs } from '../config/db.js';
import { blankKey, isSharedTshirt, sharedAvailable, readSharedEnabled, readSharedBlankRows, isAvailableFinishedGood, finishedKey } from './shared-blank-inventory.service.js';
import { COLLECTIONS } from '../constants/collections.js';
import { ApiError } from '../utils/apiError.js';
import { normalizeText } from '../utils/product.js';
import { compareStorefrontProducts } from './storefront-product-order.service.js';
import { chooseProductImages } from './product-colors.service.js';
import { availabilityForProduct, inventoryKey, isReadyQr } from './stock-availability.service.js';
import { cacheStorefrontRead } from './storefront-read-cache.service.js';
import {
  getInventoryKey, readReservationCountsAndSharedBreakdown,
} from './inventory-reservation.service.js';
import {
  decorateProductPricing,
} from './product-pricing.service.js';
import {
  localizeProduct,
  normalizeLocale,
} from './localization.service.js';

function withDefaultGallery(product) {
  const images = chooseProductImages(product, product.defaultColor);
  return decorateProductPricing({
    ...product,
    currency: product.currency || 'EUR',
    images: images.length ? images : product.images || [],
    image: images[0] || product.image || '',
  });
}

function matchVariant(product, selected) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) {
    if (selected && Object.values(selected).some(Boolean)) {
      throw new ApiError(400, 'Product has no selectable variant');
    }
    return null;
  }
  if (!selected?.sku) throw new ApiError(400, 'Choose a valid size and color');
  const found = variants.find(v =>
    String(v.sku) === String(selected.sku) &&
    String(v.size || '').toLowerCase() === String(selected.size || '').toLowerCase() &&
    String(v.color || '').toLowerCase() === String(selected.color || '').toLowerCase()
  );
  if (!found) throw new ApiError(400, 'Selected SKU, size and color do not match');
  return found;
}

export function resolveVariantOrThrow(product, selectedVariant) {
  return matchVariant(product, selectedVariant);
}

export function assertStockForVariant(product, variant, quantity) {
  const qty = Number(quantity);
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
    throw new ApiError(400, 'Quantity must be between 1 and 99');
  }
  const available = Number(variant ? variant.stock : product.stock);
  if (!Number.isSafeInteger(available) || available < qty) {
    throw new ApiError(400, 'Not enough stock for selected variant');
  }
}

// Both readiness and truly finished counts are derived from ONE QR scan,
// preserving legacy accessory behavior until the physical-stock migration.
async function readQrCounts(db) {
  const snap = await db.collection(COLLECTIONS.QR_CODES).where("status","==","available").get();
  const ready = new Map();
  const finished = new Map();
  for (const doc of snap.docs) {
    const qr=doc.data();
    if (isReadyQr(qr)) {
      const key = qr.inventoryKey || inventoryKey(qr.productId, qr.sku);
      ready.set(key,(ready.get(key)||0)+1);
    }
    if (isAvailableFinishedGood(qr)) {
      const key=finishedKey(qr.productId,qr.sku);
      finished.set(key,(finished.get(key)||0)+1);
    }
  }
  return { ready, finished };
}

// No timers; only read Firestore when a real request arrives.
function readCatalogDocuments(db) {
  return cacheStorefrontRead("products", 300_000, async () =>
    toPlainDocs(await db.collection(COLLECTIONS.PRODUCTS).get()));
}

function readStorefrontAvailability(db) {
  return cacheStorefrontRead("availability", 120_000, async () => {
    const [qr, holds, sharedEnabled] = await Promise.all([
      readQrCounts(db),
      readReservationCountsAndSharedBreakdown(db),
      readSharedEnabled(db),
    ]);
    const blankRows = sharedEnabled ? await readSharedBlankRows(db) : new Map();
    return {
      ready: qr.ready, finishedCounts: sharedEnabled ? qr.finished : new Map(),
      reserved: holds.counts, sharedHolds: holds.sharedHolds,
      sharedEnabled, blankRows,
    };
  });
}

function applyActiveReservations(product, reservedCounts, sharedEnabled = false, blankRows = new Map(), finishedCounts=new Map(), sharedHolds={blank:new Map(),finished:new Map()}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    const variants = product.variants.map((variant) => {
      const shared = sharedEnabled && isSharedTshirt(product, variant);
      const key = shared ? `blank::${blankKey(variant)}` : getInventoryKey(product.id, variant);
      const reserved = shared ? Number(sharedHolds.blank.get(key)||0)+Number(sharedHolds.finished.get(finishedKey(product.id,variant.sku))||0) : Number(reservedCounts.get(key) || 0);
      const gross = shared ? sharedAvailable(blankRows.get(blankKey(variant)))+Number(finishedCounts.get(finishedKey(product.id,variant.sku))||0) : Number(variant.stock || 0);

      return {
        ...variant,
        reservedStock: reserved,
        ...(shared ? {physicalBlankStock: Math.max(0,Number(blankRows.get(blankKey(variant))?.onHand||0)-Number(blankRows.get(blankKey(variant))?.committedPhysical||0)),
           virtualBlankStock: Math.max(0,Number(blankRows.get(blankKey(variant))?.virtualLimit||0)-Number(blankRows.get(blankKey(variant))?.backorderOpen||0)),
           readyQrStock: 0, madeToOrderStock: 0, readyFinishedStock:Number(finishedCounts.get(finishedKey(product.id,variant.sku))||0),
           inventoryMode: "shared_blank"} : {}),
        stock: Math.max(0, gross - reserved),
      };
    });

    return {
      ...product,
      variants,
      reservedStock: variants.reduce(
        (sum, variant) => sum + Number(variant.reservedStock || 0),
        0
      ),
      stock: variants.reduce(
        (sum, variant) => sum + Number(variant.stock || 0),
        0
      ),
    };
  }

  const key = getInventoryKey(product.id, null);
  const reserved = Number(reservedCounts.get(key) || 0);
  const gross = Number(product.stock || 0);

  return {
    ...product,
    reservedStock: reserved,
    stock: Math.max(0, gross - reserved),
  };
}

export async function listProductsService({category, q, featured, limit, locale = "en"} = {}) {
  const db = getDB();
  const catalog = await readCatalogDocuments(db);
  let products = catalog.filter(p => p.active !== false);
  if (category && category !== 'All') products = products.filter(p => p.category === category);
  if (featured !== undefined) {
    const desired = featured === true || featured === 'true';
    products = products.filter(p => Boolean(p.featured) === desired);
  }
  if (q) {
    const needle = normalizeText(q);
    products = products.filter((p) => {
      const localized = localizeProduct(
        p,
        normalizeLocale(locale)
      );

      return [
        localized.title,
        localized.shortDescription,
        localized.description,
        p.title,
        p.shortDescription,
        p.description,
        p.category,
        p.slug,
      ].some((field) =>
        normalizeText(field).includes(needle)
      );
    });
  }
  products.sort(compareStorefrontProducts);
  const n = Number(limit);
  if (Number.isSafeInteger(n) && n > 0) products = products.slice(0, n);
  if (!products.some(p => p.variants?.length)) {
    return products.map((product) => localizeProduct(withDefaultGallery(product), locale));
  }
  const {ready,reserved,sharedEnabled,blankRows,finishedCounts,sharedHolds} =
    await readStorefrontAvailability(db);

  return products.map((product) =>
    localizeProduct(
      withDefaultGallery(
        applyActiveReservations(
          availabilityForProduct(product, ready),
          reserved, sharedEnabled, blankRows, finishedCounts, sharedHolds
        )
      ),
      locale
    )
  );
}

export async function getProductByIdOrSlug(idOrSlug, { locale = "en", fresh = false, includeAvailability = true } = {}) {
  const db = getDB();
  const identifier = String(idOrSlug || '');
  let product;
  if (fresh) {
    const doc = await db.collection(COLLECTIONS.PRODUCTS).doc(identifier).get();
    if (doc.exists) product = { id: doc.id, ...doc.data() };
    else {
      const query = await db.collection(COLLECTIONS.PRODUCTS)
        .where("slug", "==", identifier).limit(1).get();
      if (!query.empty) product = { id: query.docs[0].id, ...query.docs[0].data() };
    }
  } else {
    const catalog = await readCatalogDocuments(db);
    product = catalog.find(p => String(p.id) === identifier || String(p.slug || "") === identifier);
  }
  if (!product || product.active === false) throw new ApiError(404, 'Product not found');
  if (!includeAvailability || !product.variants?.length) {
    return localizeProduct(
      withDefaultGallery(product),
      locale
    );
  }
  const {ready,reserved,sharedEnabled,blankRows,finishedCounts,sharedHolds} =
    await readStorefrontAvailability(db);

  return localizeProduct(
    withDefaultGallery(
      applyActiveReservations(
        availabilityForProduct(product, ready),
        reserved, sharedEnabled, blankRows, finishedCounts, sharedHolds
      )
    ),
    locale
  );
}
