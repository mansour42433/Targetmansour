export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month;

    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });
    if (!targetMonth) return res.status(400).json({ error: "Month parameter is required" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };

    try {
        // 1. حساب النطاق الزمني (4 أشهر للسرعة)
        const [year, month] = targetMonth.split('-').map(Number);
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]; 
        const startDateObj = new Date(year, month - 5, 1);
        const startDate = startDateObj.toISOString().split('T')[0];

        // 2. الروابط المحدثة (Qoyod API V2.0)
        // لاحظ Base URL: https://api.qoyod.com/2.0
        const BASE_URL = "https://api.qoyod.com/2.0";

        const urls = [
            `${BASE_URL}/invoices?q[status_in][]=Paid&q[status_in][]=Approved&q[status_in][]=Partially Paid&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}&limit=1500`,
            `${BASE_URL}/products?limit=1500`,
            `${BASE_URL}/product_units?limit=1000`,
            `${BASE_URL}/credit_notes?q[issue_date_gteq]=${startDate}&limit=500`
        ];

        const results = await Promise.all(urls.map(url => 
            fetch(url, { headers }).then(async r => {
                if (!r.ok) throw new Error(`API Error ${r.status}: ${r.statusText}`);
                return r.json();
            })
        ));

        const data = {
            invoices: results[0].invoices,
            productsMap: {},
            product_units: results[2].product_units || [],
            credit_notes: results[3].credit_notes || []
        };

        if (results[1].products) {
            results[1].products.forEach(p => {
                data.productsMap[p.id] = { name: p.name_ar || p.name_en, sku: p.sku };
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "فشل الاتصال بقيود V2.0: " + err.message });
    }
}
