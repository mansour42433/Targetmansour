// api/data.js
export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };
    const type = req.query.type;

    // ✅ ضبط الفترة لتكون 3 أشهر فقط كما طلبت
    const months = 3; 
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const dateStr = startDate.toISOString().split('T')[0];

    async function fetchPages(endpoint, key) {
        let items = [];
        let page = 1;
        while(page <= 20) { 
            const url = `https://api.qoyod.com/2.0/${endpoint}${endpoint.includes('?')?'&':'?'}page=${page}&per_page=100`;
            const r = await fetch(url, { headers });
            if(!r.ok) break;
            const d = await r.json();
            const data = d[key] || [];
            if(data.length === 0) break;
            items = items.concat(data);
            page++;
        }
        return items;
    }

    try {
        if (type === 'products') return res.json({ success: true, data: await fetchPages('products', 'products') });
        if (type === 'units') return res.json({ success: true, data: await fetchPages('product_units', 'product_units') });
        if (type === 'invoices') {
            const query = `q[issue_date_gteq]=${dateStr}&q[s]=issue_date+desc`;
            return res.json({ success: true, data: await fetchPages(`invoices?${query}`, 'invoices') });
        }
        if (type === 'returns') return res.json({ success: true, data: await fetchPages(`credit_notes?q[issue_date_gteq]=${dateStr}`, 'credit_notes') });
        
        return res.status(400).json({ error: "Invalid type" });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}
