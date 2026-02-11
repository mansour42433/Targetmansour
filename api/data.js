// api/data.js

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing" });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    const type = req.query.type || 'all';
    // جلب سنة كاملة لضمان وجود الفواتير
    const months = 12; 

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    async function fetchAllPages(baseUrl, keyName) {
        let allItems = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 40) { 
            const separator = baseUrl.includes('?') ? '&' : '?';
            const url = `${baseUrl}${separator}page=${page}`;
            try {
                const response = await fetch(url, { headers });
                if (!response.ok) { hasMore = false; break; }
                
                const data = await response.json();
                const items = data[keyName] || [];

                if (items.length === 0) {
                    hasMore = false;
                } else {
                    allItems = allItems.concat(items);
                    page++;
                }
            } catch (error) {
                hasMore = false;
                break;
            }
        }
        return allItems;
    }

    const invoicesUrl = `https://api.qoyod.com/2.0/invoices?q[issue_date_gteq]=${startDateStr}&q[issue_date_lteq]=${endDateStr}&q[s]=issue_date%20desc&per_page=100`;
    const productsUrl = `https://api.qoyod.com/2.0/products?per_page=100`;
    const unitsUrl = `https://api.qoyod.com/2.0/measurements?per_page=100`; 
    const creditNotesUrl = `https://api.qoyod.com/2.0/credit_notes?q[issue_date_gteq]=${startDateStr}&q[s]=issue_date%20desc&per_page=100`;

    try {
        if (type === 'products') return res.status(200).json({ success: true, data: await fetchAllPages(productsUrl, 'products') });
        
        if (type === 'units') {
            let data = await fetchAllPages(unitsUrl, 'measurements');
            if(data.length === 0) data = await fetchAllPages(unitsUrl, 'product_units');
            return res.status(200).json({ success: true, data: data });
        }

        if (type === 'invoices') return res.status(200).json({ success: true, data: await fetchAllPages(invoicesUrl, 'invoices') });
        if (type === 'returns') return res.status(200).json({ success: true, data: await fetchAllPages(creditNotesUrl, 'credit_notes') });

    } catch (error) {
        return res.status(500).json({ error: "Server Error", details: error.message });
    }
}
