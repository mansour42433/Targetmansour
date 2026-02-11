// api/data.js
export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };
    const type = req.query.type;

    // تحديد نطاق البحث: 4 أشهر من تاريخ الإنشاء
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 4);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    async function fetchAll(endpoint, keyName) {
        let all = [];
        let page = 1;
        let hasMore = true;
        while(hasMore && page <= 30) {
            try {
                const res = await fetch(`https://api.qoyod.com/2.0/${endpoint}${endpoint.includes('?')?'&':'?'}page=${page}`, { headers });
                if(!res.ok) break;
                const data = await res.json();
                const items = data[keyName] || [];
                if(items.length === 0) hasMore = false;
                else { all = all.concat(items); page++; }
            } catch(e) { hasMore = false; }
        }
        return all;
    }

    try {
        if (type === 'products') {
            return res.json({ success: true, data: await fetchAll('products?per_page=100', 'products') });
        }
        if (type === 'units') {
            let data = await fetchAll('product_units?per_page=100', 'product_units');
            if(data.length === 0) data = await fetchAll('measurements?per_page=100', 'measurements');
            return res.json({ success: true, data });
        }
        if (type === 'invoices') {
            // ✅ الجلب بناءً على تاريخ الإنشاء (issue_date) لضمان جلب كل الفواتير
            const query = `q[issue_date_gteq]=${startDateStr}&q[issue_date_lteq]=${endDateStr}&q[s]=issue_date+desc`;
            return res.json({ success: true, data: await fetchAll(`invoices?${query}&per_page=100`, 'invoices') });
        }
        if (type === 'returns') {
            const query = `q[issue_date_gteq]=${startDateStr}`;
            return res.json({ success: true, data: await fetchAll(`credit_notes?${query}&per_page=100`, 'credit_notes') });
        }
        return res.status(400).json({ error: "Invalid type" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
