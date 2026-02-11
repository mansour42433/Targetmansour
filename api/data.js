// api/data.js
export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };
    const type = req.query.type;

    // إعداد التواريخ (سنة كاملة لضمان عدم ضياع أي فاتورة)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    const dateParams = `&q[issue_date_gteq]=${startDate.toISOString().split('T')[0]}&q[issue_date_lteq]=${endDate.toISOString().split('T')[0]}`;

    // دالة الجلب مع التكرار (Pagination)
    async function fetchAll(endpoint, keyName) {
        let all = [];
        let page = 1;
        let hasMore = true;
        while(hasMore && page <= 30) { // حد أمان 30 صفحة
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
            // محاولة جلب الوحدات بالمسميين المحتملين
            let data = await fetchAll('product_units?per_page=100', 'product_units');
            if(data.length === 0) data = await fetchAll('measurements?per_page=100', 'measurements');
            return res.json({ success: true, data });
        }
        if (type === 'invoices') {
            // جلب الفواتير (نركز على المدفوعة والمعتمدة)
            return res.json({ success: true, data: await fetchAll(`invoices?q[status_in][]=Paid&q[status_in][]=Approved${dateParams}&per_page=100`, 'invoices') });
        }
        if (type === 'returns') {
            return res.json({ success: true, data: await fetchAll(`credit_notes?${dateParams}&per_page=100`, 'credit_notes') });
        }
        
        return res.status(400).json({ error: "Invalid type" });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
