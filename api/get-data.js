export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month; // مثال: 2026-02

    if (!API_KEY) return res.status(500).json({ error: "API Key missing" });
    if (!targetMonth) return res.status(400).json({ error: "Month parameter is required" });

    const headers = { "API-KEY": API_KEY, "Content-Type": "application/json" };

    try {
        // 1. حساب التواريخ (نطاق 4 أشهر)
        const [year, month] = targetMonth.split('-').map(Number);
        
        // تاريخ النهاية: آخر يوم في الشهر المختار
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]; 
        
        // تاريخ البداية: نعود للوراء 4 أشهر فقط
        // (month - 5) لأن الشهر في التاريخ يبدأ من 0، ولضمان تغطية 4 أشهر سابقة
        const startDateObj = new Date(year, month - 5, 1);
        const startDate = startDateObj.toISOString().split('T')[0];

        // 2. بناء رابط الفواتير مع الفلتر الزمني الضيق
        const invoiceUrl = `https://api.qoyod.com/2.0/invoices?q[status_in][]=Paid&q[status_in][]=Approved&q[status_in][]=Partially Paid&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}&limit=1500`;

        const urls = [
            invoiceUrl,
            `https://api.qoyod.com/2.0/products?limit=1500`,
            `https://api.qoyod.com/2.0/product_units?limit=1000`,
            // المرتجعات أيضاً نحضرها لنفس الفترة فقط لتخفيف الحمل
            `https://api.qoyod.com/2.0/credit_notes?q[issue_date_gteq]=${startDate}&limit=500`
        ];

        const results = await Promise.all(urls.map(url => 
            fetch(url, { headers }).then(async r => {
                if (!r.ok) throw new Error(`Status ${r.status}`);
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
        return res.status(500).json({ error: "فشل الاتصال: " + err.message });
    }
}
