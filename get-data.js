export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month;

    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };

    try {
        let dateParams = "";
        if (targetMonth) {
            const [year, month] = targetMonth.split('-').map(Number);
            // العودة 6 أشهر للوراء للبحث عن فواتير قديمة سُددت حديثاً
            const startDay = new Date(year, month - 6, 1);
            const startDate = startDay.toISOString().split('T')[0];
            // نهاية الشهر الحالي
            const endDay = new Date(year, month, 0);
            const endDate = endDay.toISOString().split('T')[0];
            
            // نجلب الفواتير في هذا النطاق العريض
            dateParams = `&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}`;
        }

        // استخدام الروابط الرسمية حسب ملف code api.txt
        const urls = [
            `https://api.qoyod.com/2.0/invoices?q[status_in][]=Paid&q[status_in][]=Partially Paid&q[status_in][]=Approved${dateParams}&limit=2500`,
            `https://api.qoyod.com/2.0/products?limit=2500`,
            `https://api.qoyod.com/2.0/product_units?limit=1000`,
            `https://api.qoyod.com/2.0/credit_notes?${dateParams}&limit=1000`
        ];

        const results = await Promise.allSettled(urls.map(url => fetch(url, { headers })));
        const data = { invoices: [], productsMap: {}, product_units: [], credit_notes: [] };

        if (results[0].status === 'fulfilled' && results[0].value.ok) data.invoices = (await results[0].value.json()).invoices;
        if (results[1].status === 'fulfilled' && results[1].value.ok) {
            const pData = await results[1].value.json();
            pData.products.forEach(p => { data.productsMap[p.id] = { name: p.name_ar || p.name_en, sku: p.sku }; });
        }
        if (results[2].status === 'fulfilled' && results[2].value.ok) {
            const uData = await results[2].value.json();
            data.product_units = uData.product_units || [];
        }
        if (results[3].status === 'fulfilled' && results[3].value.ok) data.credit_notes = (await results[3].value.json()).credit_notes;

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
