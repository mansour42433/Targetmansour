export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };

    try {
        // نستخدم V2.0 كما طلبت، مع حد 2000 فاتورة لضمان وجود البيانات
        const BASE_URL = "https://api.qoyod.com/2.0";
        
        const urls = [
            `${BASE_URL}/invoices?q[status_in][]=Paid&q[status_in][]=Partially Paid&q[status_in][]=Approved&q[s]=issue_date+desc&limit=2000`,
            `${BASE_URL}/products?limit=2000`,
            `${BASE_URL}/product_units?limit=1000`,
            `${BASE_URL}/credit_notes?q[s]=issue_date+desc&limit=500`
        ];

        const results = await Promise.all(urls.map(url => 
            fetch(url, { headers }).then(r => r.ok ? r.json() : { error: r.status })
        ));

        // تنسيق البيانات لتناسب الكود الخاص بك
        const data = {
            invoices: results[0].invoices || [],
            productsMap: {},
            product_units: results[2].product_units || [], // هذا سيتحول لـ unitsMapFactor
            credit_notes: results[3].credit_notes || []
        };

        if (results[1].products) {
            results[1].products.forEach(p => {
                data.productsMap[p.id] = { name: p.name_ar || p.name_en, sku: p.sku };
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
