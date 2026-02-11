// api/data.js
export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };
    const type = req.query.type;

    // تحديد النطاق: 3 أشهر من تاريخ الإنشاء لضمان جلب الفواتير القديمة التي سُددت الآن
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const dateStr = startDate.toISOString().split('T')[0];

    async function fetchAllPages(endpoint, key) {
        let allItems = [];
        for (let page = 1; page <= 5; page++) { // جلب 5 صفحات (500 سجل) لضمان الشمولية
            const url = `https://api.qoyod.com/2.0/${endpoint}${endpoint.includes('?')?'&':'?'}page=${page}&per_page=100`;
            const response = await fetch(url, { headers });
            if (!response.ok) break;
            const data = await response.json();
            const items = data[key] || [];
            if (items.length === 0) break;
            allItems = allItems.concat(items);
        }
        return allItems;
    }

    try {
        if (type === 'products') return res.json({ success: true, data: await fetchAllPages('products', 'products') });
        if (type === 'units') return res.json({ success: true, data: await fetchAllPages('product_units', 'product_units') });
        if (type === 'invoices') {
            const query = `q[issue_date_gteq]=${dateStr}&q[s]=issue_date+desc`;
            return res.json({ success: true, data: await fetchAllPages(`invoices?${query}`, 'invoices') });
        }
        if (type === 'returns') return res.json({ success: true, data: await fetchAllPages('credit_notes', 'credit_notes') });
        
        return res.status(400).json({ error: "Invalid type" });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
