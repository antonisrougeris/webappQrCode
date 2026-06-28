import { sendEmail } from "./email.service.js";
import { nowIso } from "../utils/ids.js";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";

function money(value, currency = "EUR") {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function orderItemsHtml(order) {
  return (order.items || [])
    .map((item) => {
      const variantParts = [];

      if (item.variant?.size) variantParts.push(`Size: ${item.variant.size}`);
      if (item.variant?.color) variantParts.push(`Color: ${item.variant.color}`);

      const variant = variantParts.length
        ? `<br/><span style="color:#777;font-size:13px;">${escapeHtml(
            variantParts.join(" · ")
          )}</span>`
        : "";

      const qr = item.qrDestination
        ? `<br/><span style="color:#777;font-size:13px;">QR: ${escapeHtml(
            item.qrDestination
          )}</span>`
        : "";

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(item.title)}</strong>
            ${variant}
            ${qr}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;text-align:center;">
            ${Number(item.quantity || 0)}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;text-align:right;">
            ${money(item.lineTotal, item.currency || order.currency || "EUR")}
          </td>
        </tr>
      `;
    })
    .join("");
}

function customerName(order) {
  return `${order.customer?.firstName || ""} ${
    order.customer?.lastName || ""
  }`.trim();
}

function shippingHtml(order) {
  const address = order.shippingAddress || {};

  return `
    <p style="line-height:1.7;color:#555;margin:0;">
      ${escapeHtml(address.firstName || order.customer?.firstName || "")}
      ${escapeHtml(address.lastName || order.customer?.lastName || "")}<br/>
      ${escapeHtml(address.addressLine1 || "")}<br/>
      ${
        address.addressLine2
          ? `${escapeHtml(address.addressLine2)}<br/>`
          : ""
      }
      ${escapeHtml(address.city || "")}
      ${address.postalCode ? `, ${escapeHtml(address.postalCode)}` : ""}<br/>
      ${escapeHtml(address.country || "Greece")}<br/>
      ${address.phone ? `Phone: ${escapeHtml(address.phone)}<br/>` : ""}
    </p>

    <p style="line-height:1.7;color:#555;margin-top:14px;">
      <strong>Delivery:</strong> ${escapeHtml(order.delivery || "home")}
      ${
        order.locker
          ? `<br/><strong>Locker:</strong> ${escapeHtml(order.locker)}`
          : ""
      }
    </p>
  `;
}

function baseTemplate({ title, intro, body }) {
  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f6f6f4;">
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f6f4;padding:32px 16px;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;padding:34px;border:1px solid #eeeeee;">
            <div style="text-align:center;margin-bottom:30px;">
              <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#111;">
                SKANARE
              </div>
              <div style="font-size:12px;color:#777;margin-top:8px;letter-spacing:1px;">
                QR CLOTHING & ACCESSORIES
              </div>
            </div>

            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#111;">
              ${escapeHtml(title)}
            </h1>

            <p style="color:#555;line-height:1.7;margin:0 0 24px;font-size:15px;">
              ${escapeHtml(intro)}
            </p>

            ${body}

            <div style="margin-top:34px;padding-top:20px;border-top:1px solid #eee;color:#777;font-size:13px;line-height:1.6;">
              <p style="margin:0;">
                Need help? Contact us at
                <a href="mailto:hello@skanare.com" style="color:#111;font-weight:700;">hello@skanare.com</a>.
              </p>
              <p style="margin:10px 0 0;">Thank you for choosing Skanare.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function customerOrderHtml(order) {
  const name = customerName(order);

  return baseTemplate({
    title: "Order confirmed",
    intro: `Hi ${name || "there"}, your payment was successful and your Skanare order is confirmed.`,
    body: `
      <div style="background:#f7f7f7;border-radius:16px;padding:18px;margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order number:</strong> ${escapeHtml(
          order.orderNumber || order.id
        )}</p>
        <p style="margin:0;"><strong>Total paid:</strong> ${money(
          order.total,
          order.currency || "EUR"
        )}</p>
      </div>

      <h2 style="font-size:18px;margin:26px 0 10px;color:#111;">Order items</h2>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:10px;color:#555;">Product</th>
            <th style="text-align:center;padding-bottom:10px;color:#555;">Qty</th>
            <th style="text-align:right;padding-bottom:10px;color:#555;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${orderItemsHtml(order)}
        </tbody>
      </table>

      <div style="margin-top:24px;background:#fafafa;border-radius:16px;padding:18px;">
        <p style="margin:0 0 8px;"><strong>Subtotal:</strong> ${money(
          order.subtotal,
          order.currency || "EUR"
        )}</p>
        <p style="margin:0 0 8px;"><strong>Shipping:</strong> ${money(
          order.shippingCost,
          order.currency || "EUR"
        )}</p>
        <p style="margin:0;font-size:17px;"><strong>Total:</strong> ${money(
          order.total,
          order.currency || "EUR"
        )}</p>
      </div>

      <h2 style="font-size:18px;margin:26px 0 10px;color:#111;">Shipping details</h2>
      ${shippingHtml(order)}

      ${
        Number(order.qrCodesCreated || 0) > 0
          ? `
            <div style="margin-top:24px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:18px;color:#14532d;">
              Your QR product is active. You can manage your QR codes from your Skanare account.
            </div>
          `
          : ""
      }
    `,
  });
}

function adminOrderHtml(order) {
  const customer = order.customer || {};

  return baseTemplate({
    title: "New paid order",
    intro: "A new paid order was received on Skanare.",
    body: `
      <div style="background:#f7f7f7;border-radius:16px;padding:18px;margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(
          order.orderNumber || order.id
        )}</p>
        <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(
          order.id
        )}</p>
        <p style="margin:0;"><strong>Total:</strong> ${money(
          order.total,
          order.currency || "EUR"
        )}</p>
      </div>

      <h2 style="font-size:18px;margin:26px 0 10px;color:#111;">Customer</h2>
      <p style="line-height:1.7;color:#555;margin:0;">
        ${escapeHtml(customer.firstName || "")} ${escapeHtml(
      customer.lastName || ""
    )}<br/>
        ${escapeHtml(customer.email || "")}<br/>
        ${escapeHtml(customer.phone || "")}
      </p>

      <h2 style="font-size:18px;margin:26px 0 10px;color:#111;">Items</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>
          ${orderItemsHtml(order)}
        </tbody>
      </table>

      <h2 style="font-size:18px;margin:26px 0 10px;color:#111;">Shipping</h2>
      ${shippingHtml(order)}

      <h2 style="font-size:18px;margin:26px 0 10px;color:#111;">Payment</h2>
      <p style="line-height:1.7;color:#555;margin:0;">
        Provider: ${escapeHtml(order.paymentProvider || "viva")}<br/>
        Status: ${escapeHtml(order.paymentStatus || "paid")}<br/>
        Transaction: ${escapeHtml(order.payment?.transactionId || "-")}
      </p>
    `,
  });
}

export async function sendPaidOrderEmails(order) {
  const db = getDB();
  const orderRef = db.collection(COLLECTIONS.ORDERS).doc(order.id);
  const freshSnap = await orderRef.get();

  if (!freshSnap.exists) {
    console.warn("Paid order email skipped: order not found", {
      orderId: order.id,
    });
    return;
  }

  const freshOrder = { id: freshSnap.id, ...freshSnap.data() };

  if (freshOrder.emails?.paidOrderSentAt) {
    console.log("Paid order emails already sent", {
      orderId: freshOrder.id,
    });
    return;
  }

  const customerEmail = freshOrder.customer?.email;
  const adminEmail = process.env.ADMIN_EMAIL;
  const from = process.env.EMAIL_ORDER || process.env.EMAIL_FROM;

  const sent = {
    customerOrderEmail: null,
    adminOrderEmail: null,
  };

  if (customerEmail) {
    await sendEmail({
      from,
      to: customerEmail,
      subject: `Your Skanare order ${freshOrder.orderNumber || freshOrder.id} is confirmed`,
      html: customerOrderHtml(freshOrder),
    });

    sent.customerOrderEmail = customerEmail;
  }

  if (adminEmail) {
    await sendEmail({
      from,
      to: adminEmail,
      subject: `New paid order ${freshOrder.orderNumber || freshOrder.id}`,
      html: adminOrderHtml(freshOrder),
    });

    sent.adminOrderEmail = adminEmail;
  }

  await orderRef.set(
    {
      emails: {
        paidOrderSentAt: nowIso(),
        ...sent,
      },
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}