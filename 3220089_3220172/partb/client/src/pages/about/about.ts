/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { initModalUI } from "../../components/modal";
import { initVideosSection } from "../../scripts/videos-section";
import { updateCartBadge } from "../../utils/cart-badge";

// Initialize navigation (handles login/logout state)
initNav();
initMobileMenu();
updateCartBadge();

// Initialize modal for video playback
initModalUI();

// Initialize video
initVideosSection("why-devdromos");
