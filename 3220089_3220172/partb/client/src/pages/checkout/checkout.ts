/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { updateCartBadge } from "../../utils/cart-badge";

initNav();
updateCartBadge();
import { requireAuth } from "../../services/authGuard";
requireAuth();