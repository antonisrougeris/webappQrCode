import { renderHeader } from "./header";
import { renderFooter } from "./footer";

import { initNav } from "./initNav";
import { initMobileMenu } from "./menu";

import { updateCartBadge } from "../utils/cart-badge";

export function initLayout(): void {
  renderHeader();
  renderFooter();

  initNav();
  initMobileMenu();

  void updateCartBadge();
}