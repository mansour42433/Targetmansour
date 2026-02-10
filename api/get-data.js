export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key is missing" });

    const headers = { 
        "API-KEY": API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "BonusSystem"
    };

    try {
        const BASE_URL = "https://api.qoyod.com/2.0";
        
        // عدنا للطريقة التي كانت تعمل (بدون فلتر تاريخ معقد)
        // نطلب آخر 2500 فاتورة، مرتبة من الأحدث للأقدم
        // هذا الطلب يغطي أشهرك المطلوبة وزيادة، وهو مضمون القبول من قيود
        const limit = 2500;

        const urls = [
            // الفواتير
            `${BASE_URL}/invoices?q[status_in][]=Paid&q[status_in][]=Approved&q[status_in][]=Partially Paid&q[s]=issue_date+desc&limit=${limit}`,
            // المنتجات
            `${BASE_URL}/products?limit=2500`,
            // الوحدات
            `${BASE_URL}/product_units?limit=1000`,
            // المرتجعات
            `${BASE_URL}/credit_notes?q[s]=issue_date+desc&limit=1000`
        ];

        // تنفيذ الطلبات مع فحص دقيق للخطأ
        const results = await Promise.all(urls.map(async url => {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                // هنا نقرأ رسالة الخطأ الحقيقية من قيود
                const errText = await response.text();
                return { error: true, status: response.status, msg: errText };
            }
            return await response.json();
        }));

        // إذا فشل رابط الفواتير تحديداً، نوقف العملية ونعرض الخطأ
        if (results[0].error) {
            throw new Error(`خطأ من قيود (Invoices): ${results[0].status} - ${results[0].msg}`);
        }

        const data = {
            invoices: results[0].invoices || [],
            productsMap: {},
            product_units: (!results[2].error && results[2].product_units) ? results[2].product_units : [],
            credit_notes: (!results[3].error && results[3].credit_notes) ? results[3].credit_notes : []
        };

        // معالجة المنتجات
        if (!results[1].error && results[1].products) {
            results[1].products.forEach(p => {
                data.productsMap[p.id] = { name: p.name_ar || p.name_en, sku: p.sku };
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        // إرسال تفاصيل الخطأ للواجهة
        return res.status(500).json({ error: err.message });
    }
}
