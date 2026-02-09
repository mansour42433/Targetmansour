let rawInvoices = [];
let productsMap = {};
let unitsMap = {};
let creditNotesMap = {};
let unitsMapFactor = {};

let computed = [];
let excludedInvoices = [];

// ===============================
// تحميل البيانات
// ===============================
async function loadData() {
    const res = await fetch("/api/get-data");
    const data = await res.json();

    rawInvoices = data.invoices || [];
    productsMap = data.productsMap || {};

    (data.product_units || []).forEach(u => {
        unitsMapFactor[u.id] = parseFloat(u.factor || 1);
    });

    (data.credit_notes || []).forEach(cn => {
        creditNotesMap[cn.id] = cn;
    });

    processLogic();
}

// ===============================
// المنطق المحاسبي
// ===============================
function processLogic() {
    computed = [];
    excludedInvoices = [];

    const [tYear, tMonth] =
        document.getElementById("targetMonth").value.split("-").map(Number);

    rawInvoices.forEach(inv => {

        const baseInfo = {
            reference: inv.reference,
            customer: inv.customer_name,
            status: inv.status,
            issue_date: inv.issue_date,
            total: inv.total
        };

        // ❌ غير مدفوعة
        if (inv.status !== "Paid") {
            excludedInvoices.push({ ...baseInfo, reason: "غير مدفوعة" });
            return;
        }

        const payments = inv.payments || [];
        const total = parseFloat(inv.total || 0);
        const totalPaid =
            payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

        // ❌ دفع جزئي
        if (Math.abs(totalPaid - total) > 0.01) {
            excludedInvoices.push({ ...baseInfo, reason: "دفع جزئي" });
            return;
        }

        // تحديد آجل / نقدي
        let isDeferred = false;
        let lastPaymentDate = inv.issue_date;

        if (payments.length > 0) {
            payments.forEach(p => {
                if (p.date !== inv.issue_date) isDeferred = true;
                if (new Date(p.date) > new Date(lastPaymentDate)) {
                    lastPaymentDate = p.date;
                }
            });
        }

        const refDate = isDeferred ? lastPaymentDate : inv.issue_date;
        const d = new Date(refDate);

        // ❌ خارج الشهر
        if (d.getFullYear() !== tYear || (d.getMonth() + 1) !== tMonth) {
            excludedInvoices.push({
                ...baseInfo,
                reason: "خارج الشهر",
                counted_date: refDate
            });
            return;
        }

        // المرتجعات
        let returns = {};
        (inv.allocations || []).forEach(a => {
            if (a.source_type === "CreditNote") {
                const cn = creditNotesMap[a.source_id];
                (cn?.line_items || []).forEach(li => {
                    returns[li.product_id] =
                        (returns[li.product_id] || 0)
                        + parseFloat(li.quantity || 0);
                });
            }
        });

        let hasValidItems = false;

        inv.line_items.forEach(item => {

            const pid = item.product_id;
            const priceInclTax =
                parseFloat(item.unit_price || 0) *
                (1 + (parseFloat(item.tax_percent || 0) / 100));

            let mult = 1;
            if (!(item.unit_type_name || "").includes("كرتون")) {
                mult = unitsMapFactor[item.unit_type] || 1;
            }

            const cartonPrice = priceInclTax * mult;

            const netQty = Math.max(
                0,
                parseFloat(item.quantity || 0) - (returns[pid] || 0)
            );

            let pct = 0;
            if (cartonPrice >= 70) pct = 2;
            else if (cartonPrice > 0) pct = 1;

            if (!pct || !netQty) return;

            hasValidItems = true;

            const totalSales = priceInclTax * netQty;
            const bonus = totalSales * (pct / 100);

            computed.push({
                invoice: inv.reference,
                rep: inv.created_by,
                product: productsMap[pid]?.name || item.product_name,
                qty: netQty,
                cartonPrice: cartonPrice.toFixed(2),
                pct,
                bonus: bonus.toFixed(2),
                totalSales: totalSales.toFixed(2),
                type: isDeferred ? "آجل" : "نقدي",
                date: refDate
            });
        });

        // ❌ بدون بنود صالحة
        if (!hasValidItems) {
            excludedInvoices.push({
                ...baseInfo,
                reason: "لا توجد بنود صالحة للبونص"
            });
        }
    });

    renderUI();
    renderExcluded();
}

// ===============================
// العرض
// ===============================
function renderUI() {
    console.table(computed);
}

function renderExcluded() {
    console.table(excludedInvoices);
}

// تحميل أولي
document.addEventListener("DOMContentLoaded", loadData);