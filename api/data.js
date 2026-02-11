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
    // الجلب التلقائي لـ 4 أشهر حسب طلبك
    const months = 4; 

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    async function fetchAllPages(baseUrl, maxPages = 30) {
        let allItems = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= maxPages) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const url = `${baseUrl}${separator}page=${page}`;
            try {
                const response = await fetch(url, { headers });
                if (!response.ok) { hasMore = false; break; }
                
                const data = await response.json();
                
                // البحث الذكي عن مصفوفة البيانات (لتجاوز قسم meta)
                let items = [];
                for (const key in data) {
                    if (Array.isArray(data[key])) {
                        items = data[key];
                        break;
                    }
                }

                if (!items || items.length === 0) {
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

    // الروابط لجلب الفواتير (من تاريخ الإنشاء لتغطية الفواتير القديمة التي دُفعت هذا الشهر)
    const invoicesUrl = `https://api.qoyod.com/2.0/invoices?q[issue_date_gteq]=${startDateStr}&q[issue_date_lteq]=${endDateStr}&q[s]=issue_date%20desc&per_page=100`;
    const productsUrl = `https://api.qoyod.com/2.0/products?per_page=100`;
    const unitsUrl = `https://api.qoyod.com/2.0/measurements?per_page=100`; 
    const creditNotesUrl = `https://api.qoyod.com/2.0/credit_notes?q[issue_date_gteq]=${startDateStr}&q[s]=issue_date%20desc&per_page=100`;

    try {
        if (type === 'products') return res.status(200).json({ success: true, data: await fetchAllPages(productsUrl) });
        if (type === 'units') return res.status(200).json({ success: true, data: await fetchAllPages(unitsUrl) });
        if (type === 'invoices') return res.status(200).json({ success: true, data: await fetchAllPages(invoicesUrl) });
        if (type === 'returns') return res.status(200).json({ success: true, data: await fetchAllPages(creditNotesUrl) });

        if (type === 'all') {
            const invoices = await fetchAllPages(invoicesUrl);
            const products = await fetchAllPages(productsUrl);
            const units = await fetchAllPages(unitsUrl);
            const creditNotes = await fetchAllPages(creditNotesUrl);

            const productsMap = {};
            products.forEach(p => {
                productsMap[p.id] = { name: p.name_ar || p.name_en, sku: p.sku || "", id: p.id };
            });

            return res.status(200).json({
                success: true,
                invoices,
                productsMap,
                product_units: units,
                credit_notes: creditNotes,
            });
        }

    } catch (error) {
        return res.status(500).json({ error: "Server Error", details: error.message });
    }
}
