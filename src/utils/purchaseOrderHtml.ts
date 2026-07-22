/**
 * Purchase Order — a dedicated, modern document template (separate from the
 * generic report engine). Classic PO layout: buyer header + PO no./date/status,
 * vendor & deliver-to blocks, a MULTI-item line-items table, and a totals box —
 * then a signature. No payment info (a PO is the order, not the ledger). PURE
 * string building; asset loading + printing live in reportPdf.ts.
 */
import { REPORT_COLORS as C, type ReportAssets } from './reportHtml';

export interface PurchaseOrderLine {
  name: string;
  qtyText: string;
  receivedText: string;
  rateText: string;
  amountText: string;
  fullyReceived: boolean;
}

export interface PurchaseOrder {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  poNumber: string;
  dateText: string;
  statusLabel: string;
  vendorName: string | null;
  vendorPhone: string | null;
  deliverTo: string | null;
  items: PurchaseOrderLine[];
  totalText: string;
  L: {
    purchaseOrder: string;
    poNo: string;
    date: string;
    vendor: string;
    deliverTo: string;
    item: string;
    qty: string;
    received: string;
    rate: string;
    amount: string;
    total: string;
    authorizedSignature: string;
    madeWith: string;
  };
}

const esc = (s: string | null | undefined): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render the full Purchase Order HTML document. */
export function renderPurchaseOrderHtml(po: PurchaseOrder, assets: ReportAssets): string {
  const { L } = po;
  const companyMark = assets.companyLogo
    ? `<img class="clogo" src="data:image/jpeg;base64,${assets.companyLogo}"/>`
    : `<div class="clogo cfallback">${esc(po.company.name.charAt(0).toUpperCase())}</div>`;
  const footerInner = `<img class="flogo" src="data:image/png;base64,${assets.wordmark}"/><div class="flegal">${esc(po.company.name)} · ${esc(po.dateText)} · ${esc(L.madeWith)}</div>`;

  const itemRows = po.items
    .map(
      (it) => `<tr>
        <td class="itemname">${esc(it.name)}</td>
        <td class="num">${esc(it.qtyText)}</td>
        <td class="num ${it.fullyReceived ? 'recv-ok' : ''}">${esc(it.receivedText)}</td>
        <td class="num">${esc(it.rateText)}</td>
        <td class="num">${esc(it.amountText)}</td>
      </tr>`
    )
    .join('');

  return `
  <style>
    @font-face { font-family: 'AppFont'; font-weight: 400; src: url(data:font/ttf;base64,${assets.fontRegular}) format('truetype'); }
    @font-face { font-family: 'AppFont'; font-weight: 700; src: url(data:font/ttf;base64,${assets.fontBold}) format('truetype'); }
    @font-face { font-family: 'Naskh'; font-weight: 400; src: url(data:font/ttf;base64,${assets.naskh}) format('truetype'); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 0; }
    body { font-family: 'AppFont','Naskh',sans-serif; color: ${C.text}; background: #fff; -webkit-print-color-adjust: exact; }
    .sheet { width: 100%; border-collapse: separate; border-spacing: 0; border: 0; }
    .sheet > thead { display: table-header-group; }
    .sheet > thead > tr > td, .sheet > tbody > tr > td, .sheet > tfoot > tr > td { padding: 0; border: 0; }
    .headpad { padding: 24px 40px 14px; }
    .bodypad { padding: 20px 40px 24px; }

    .pohead { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid ${C.accent}; }
    .hleft { display: flex; align-items: center; gap: 13px; }
    .clogo { width: 52px; height: 52px; border-radius: 13px; object-fit: cover; }
    .cfallback { background: ${C.heroBg}; color: #fff; font-weight: 700; font-size: 24px; display: flex; align-items: center; justify-content: center; }
    .cname { font-size: 18px; font-weight: 700; letter-spacing: .2px; }
    .cmeta { font-size: 10px; color: ${C.textSoft}; margin-top: 3px; letter-spacing: .3px; }
    .hright { text-align: right; }
    .potype { font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: ${C.accent}; }
    .pometa { font-size: 10px; color: ${C.textMid}; margin-top: 5px; letter-spacing: .3px; }
    .pometa b { color: ${C.text}; font-weight: 700; }
    .postatus { display: inline-block; margin-top: 7px; background: ${C.accentSoft}; color: ${C.accent}; font-size: 8.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; border-radius: 999px; padding: 4px 10px; }

    .parties { display: flex; gap: 14px; margin: 4px 0 18px; }
    .party { flex: 1; border: 1px solid ${C.border}; border-radius: 12px; padding: 12px 15px; background: ${C.bg}; }
    .plabel { font-size: 8.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: ${C.textSoft}; }
    .pname { font-size: 15px; font-weight: 700; margin-top: 5px; }
    .psub { font-size: 11px; color: ${C.textMid}; margin-top: 2px; letter-spacing: .3px; }

    table.items { width: 100%; border-collapse: collapse; }
    table.items th { text-align: left; font-size: 8.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: #fff; background: ${C.heroBg}; padding: 10px 12px; }
    table.items th.num { text-align: right; }
    table.items th:first-child { border-top-left-radius: 10px; }
    table.items th:last-child { border-top-right-radius: 10px; }
    table.items td { font-size: 12px; padding: 11px 12px; border-bottom: 1px solid ${C.border}; }
    table.items tbody tr:nth-child(even) td { background: ${C.bg}; }
    table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .itemname { font-weight: 700; }
    .recv-ok { color: ${C.accent}; font-weight: 700; }

    .totals { margin-top: 16px; margin-left: auto; width: 260px; }
    .trow { display: flex; justify-content: space-between; padding: 9px 4px; }
    .trow.grand { border-top: 2px solid ${C.text}; font-size: 15px; }
    .trow.grand span { font-weight: 700; }
    .trow.grand .amt { color: ${C.accent}; font-variant-numeric: tabular-nums; }

    .sign { margin-top: 44px; width: 220px; }
    .signline { border-bottom: 1.4px solid ${C.textSoft}; height: 30px; }
    .signlabel { font-size: 10px; font-weight: 700; color: ${C.textMid}; margin-top: 7px; letter-spacing: .3px; }

    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 1.2px solid ${C.border}; height: 52px; padding: 0 40px; background: #fff; }
    .flogo { height: 26px; }
    .flegal { font-size: 7.5px; font-weight: 600; letter-spacing: .9px; text-transform: uppercase; color: ${C.textSoft}; }
    .footer-fixed { display: none; }
    @media print {
      .sheet > tfoot .footer { visibility: hidden; }
      .footer-fixed { display: flex; position: fixed; left: 0; right: 0; bottom: 0; }
    }
  </style>

  <table class="sheet">
    <thead><tr><td>
      <div class="headpad">
        <div class="pohead">
          <div class="hleft">
            ${companyMark}
            <div>
              <div class="cname">${esc(po.company.name)}</div>
              <div class="cmeta">${[po.company.ownerName, po.company.phone].filter(Boolean).map(esc).join(' · ')}</div>
            </div>
          </div>
          <div class="hright">
            <div class="potype">${esc(L.purchaseOrder)}</div>
            <div class="pometa">${esc(L.poNo)}: <b>${esc(po.poNumber)}</b></div>
            <div class="pometa">${esc(L.date)}: <b>${esc(po.dateText)}</b></div>
            <div class="postatus">${esc(po.statusLabel)}</div>
          </div>
        </div>
      </div>
    </td></tr></thead>

    <tbody><tr><td>
      <div class="bodypad">
        <div class="parties">
          <div class="party">
            <div class="plabel">${esc(L.vendor)}</div>
            <div class="pname">${esc(po.vendorName || '—')}</div>
            ${po.vendorPhone ? `<div class="psub">${esc(po.vendorPhone)}</div>` : ''}
          </div>
          <div class="party">
            <div class="plabel">${esc(L.deliverTo)}</div>
            <div class="pname">${esc(po.deliverTo || '—')}</div>
          </div>
        </div>

        <table class="items">
          <thead><tr>
            <th>${esc(L.item)}</th>
            <th class="num">${esc(L.qty)}</th>
            <th class="num">${esc(L.received)}</th>
            <th class="num">${esc(L.rate)}</th>
            <th class="num">${esc(L.amount)}</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="totals">
          <div class="trow grand"><span>${esc(L.total)}</span><span class="amt">${esc(po.totalText)}</span></div>
        </div>

        <div class="sign">
          <div class="signline"></div>
          <div class="signlabel">${esc(L.authorizedSignature)}</div>
        </div>
      </div>
    </td></tr></tbody>

    <tfoot><tr><td>
      <div class="footer">${footerInner}</div>
    </td></tr></tfoot>
  </table>
  <div class="footer footer-fixed">${footerInner}</div>`;
}
