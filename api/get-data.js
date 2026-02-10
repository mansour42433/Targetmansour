export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    // نستقبل العدد المطلوب من الواجهة، أو نستخدم 500 كافتراضي آمن
    const limit = req.query.limit || 500; 
    
    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

    const headers = { 
        "API-KEY": API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "BonusSystem_V48"
    };

    try {
        const BASE_URL = "https://api.qoyod.com/2.0";

        // نطلب البيانات بناءً على العدد الذي اخترته أنت
        const urls = [
            // الفواتير: نستخدم المتغير limit
            `${BASE_URL}/invoices?q[status_in][]=Paid&q[status_in][]=Approved&q[status_in][]=Partially Paid&q[s]=issue_date+desc&limit=${limit}`,
            // المنتجات: نطلب 2000 لضمان تغطية الأسماء (عادة المنتجات أخف من الفواتير)
            `${BASE_URL}/products?limit=2000`,
            // الوحدات
            `${BASE_URL}/product_units?limit=1000`,
            // المرتجعات: نقللها للنصف لتسريع الطلب
            `${BASE_URL}/credit_notes?q[s]=issue_date+desc&limit=500`
        ];

        // تنفيذ الطلبات
        const results = await Promise.all(urls.map(async url => {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errText = await response.text();
                return { error: true, status: response.status, msg: errText };
            }
            return await response.json();
        }));

        if (results[0].error) throw new Error(`فشل جلب الفواتير: ${results[0].status} - ${results[0].msg}`);

        const data = {
            invoices: results[0].invoices || [],
            productsMap: {},
            product_units: (!results[2].error && results[2].product_units) ? results[2].product_units : [],
            credit_notes: (!results[3].error && results[3].credit_notes) ? results[3].credit_notes : []
        };

        if (!results[1].error && results[1].products) {
            results[1].products.forEach(p => {
                data.productsMap[p.id] = { name: p.name_ar || p.name_en, sku: p.sku };
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
