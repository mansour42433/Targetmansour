export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month; // نستقبل الشهر (2026-02)

    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    // حساب تاريخ البداية (قبل 4 أشهر من الشهر المختار)
    let startDate;
    if (targetMonth) {
        const d = new Date(targetMonth);
        d.setMonth(d.getMonth() - 4);
        startDate = d.toISOString().split('T')[0];
    } else {
        startDate = "2025-01-01"; // احتياط
    }

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };

    try {
        const BASE_URL = "https://api.qoyod.com/2.0";

        // نطلب البيانات مع فلتر التاريخ (q[issue_date_gteq])
        const urls = [
            `${BASE_URL}/invoices?q[status_in][]=Paid&q[status_in][]=Partially Paid&q[status_in][]=Approved&q[issue_date_gteq]=${startDate}&q[s]=issue_date+desc&limit=2500`,
            `${BASE_URL}/products?limit=2500`,
            `${BASE_URL}/product_units?limit=1000`,
            `${BASE_URL}/credit_notes?q[issue_date_gteq]=${startDate}&limit=1000`
        ];

        const results = await Promise.allSettled(urls.map(url => fetch(url, { headers })));
        
        const data = { invoices: [], productsMap: {}, product_units: [], credit_notes: [] };

        if (results[0].status === 'fulfilled' && results[0].value.ok) {
            data.invoices = (await results[0].value.json()).invoices;
        } else {
            throw new Error("فشل جلب الفواتير من المصدر");
        }

        if (results[1].status === 'fulfilled' && results[1].value.ok) {
            const p = await results[1].value.json();
            if(p.products) p.products.forEach(x => data.productsMap[x.id] = { name: x.name_ar || x.name_en, sku: x.sku });
        }

        if (results[2].status === 'fulfilled' && results[2].value.ok) {
            const u = await results[2].value.json();
            data.product_units = u.product_units || [];
        }

        if (results[3].status === 'fulfilled' && results[3].value.ok) {
            const c = await results[3].value.json();
            data.credit_notes = c.credit_notes || [];
        }

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
