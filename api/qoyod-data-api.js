export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ 
            error: "API Key missing",
            message: "يرجى التأكد من إضافة QOYOD_API_KEY في متغيرات البيئة"
        });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
        const urls = [
            // فقط الفواتير المدفوعة - Paid
            `https://api.qoyod.com/2.0/invoices?q[status_in][]=Paid&q[s]=issue_date+desc&limit=3000`,
            `https://api.qoyod.com/2.0/products?limit=3000`,
            `https://api.qoyod.com/2.0/product_units?limit=1000`,
            `https://api.qoyod.com/2.0/credit_notes?q[s]=issue_date+desc&limit=1000`
        ];

        const results = await Promise.allSettled(
            urls.map(url => fetch(url, { headers }).then(async r => {
                if (!r.ok) {
                    const errorText = await r.text();
                    throw new Error(`HTTP ${r.status}: ${errorText}`);
                }
                return r;
            }))
        );

        const data = {
            invoices: [],
            productsMap: {},
            product_units: [],
            credit_notes: [],
            errors: [],
            stats: {
                invoicesCount: 0,
                productsCount: 0,
                unitsCount: 0,
                creditNotesCount: 0
            }
        };

        // معالجة الفواتير
        if (results[0].status === "fulfilled" && results[0].value.ok) {
            const invData = await results[0].value.json();
            data.invoices = invData.invoices || [];
            data.stats.invoicesCount = data.invoices.length;
        } else {
            data.errors.push({
                source: "invoices",
                message: results[0].reason?.message || "فشل في جلب الفواتير"
            });
        }

        // معالجة المنتجات
        if (results[1].status === "fulfilled" && results[1].value.ok) {
            const pData = await results[1].value.json();
            (pData.products || []).forEach(p => {
                data.productsMap[p.id] = {
                    name: p.name_ar || p.name_en || `منتج ${p.id}`,
                    sku: p.sku || ""
                };
            });
            data.stats.productsCount = Object.keys(data.productsMap).length;
        } else {
            data.errors.push({
                source: "products",
                message: results[1].reason?.message || "فشل في جلب المنتجات"
            });
        }

        // معالجة الوحدات
        if (results[2].status === "fulfilled" && results[2].value.ok) {
            const uData = await results[2].value.json();
            data.product_units = uData.product_units || [];
            data.stats.unitsCount = data.product_units.length;
        } else {
            data.errors.push({
                source: "product_units",
                message: results[2].reason?.message || "فشل في جلب الوحدات"
            });
        }

        // معالجة إشعارات الدائن
        if (results[3].status === "fulfilled" && results[3].value.ok) {
            const cData = await results[3].value.json();
            data.credit_notes = cData.credit_notes || [];
            data.stats.creditNotesCount = data.credit_notes.length;
        } else {
            data.errors.push({
                source: "credit_notes",
                message: results[3].reason?.message || "فشل في جلب إشعارات الدائن"
            });
        }

        // إذا كانت كل الطلبات فشلت
        if (data.errors.length === 4) {
            return res.status(500).json({
                error: "فشل في جلب جميع البيانات من Qoyod API",
                details: data.errors
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        console.error("خطأ غير متوقع:", err);
        return res.status(500).json({ 
            error: err.message,
            message: "حدث خطأ غير متوقع أثناء جلب البيانات"
        });
    }
}