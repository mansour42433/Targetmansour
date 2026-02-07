// api/get-data.js

// ملاحظة: لا نحتاج لعمل import لـ node-fetch في Node.js 18+ على Vercel
// export default async function handler(req, res) { ... }

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month;

    // 1. التحقق من المفتاح
    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing in Vercel Settings" });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
    // 2. إعداد التواريخ (جلب 3 أشهر: الشهر المختار + الشهرين السابقين)
    let dateParams = "";
    if (targetMonth) {
        const [year, month] = targetMonth.split('-').map(Number);
        
        // حساب تاريخ البداية (قبل شهرين من الشهر المختار)
        const startDateObj = new Date(year, month - 3, 1);
        const startDate = startDateObj.toISOString().slice(0, 10);
        
        // حساب تاريخ النهاية (آخر يوم في الشهر المختار)
        const endDateObj = new Date(year, month, 0);
        const endDate = endDateObj.toISOString().slice(0, 10);
        
        dateParams = `&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}`;
    }

        // 3. الروابط (V2)
        // جلب الفواتير المدفوعة فقط (تحسين الأداء)
        const invUrl = `https://api.qoyod.com/2.0/invoices?q[status_in][]=Paid${dateParams}&limit=2000`;
        const prodUrl = "https://api.qoyod.com/2.0/products?limit=2000";
        const unitsUrl = "https://api.qoyod.com/2.0/product_units?limit=500";

        // 4. التنفيذ (استخدام fetch المدمج)
        // نستخدم Promise.allSettled لكي لا ينهار الكود لو فشل رابط واحد (مثل الوحدات)
        const results = await Promise.allSettled([
            fetch(invUrl, { headers }),
            fetch(prodUrl, { headers }),
            fetch(unitsUrl, { headers })
        ]);

        const [invRes, prodRes, unitsRes] = results;

        // 5. التحقق من الفواتير (إجباري)
        if (invRes.status === 'rejected' || !invRes.value.ok) {
            const err = invRes.status === 'fulfilled' ? await invRes.value.text() : invRes.reason;
            throw new Error(`خطأ في جلب الفواتير: ${err}`);
        }

        // 6. التحقق من المنتجات (إجباري)
        if (prodRes.status === 'rejected' || !prodRes.value.ok) {
            const err = prodRes.status === 'fulfilled' ? await prodRes.value.text() : prodRes.reason;
            throw new Error(`خطأ في جلب المنتجات: ${err}`);
        }

        // استخراج البيانات
        const invData = await invRes.value.json();
        const prodData = await prodRes.value.json();
        
        // الوحدات (اختياري - لو فشل لن يوقف النظام)
        let unitsList = [];
        if (unitsRes.status === 'fulfilled' && unitsRes.value.ok) {
            const unitsData = await unitsRes.value.json();
            unitsList = unitsData.product_units || [];
        }

        // تجهيز المنتجات
        const productsMap = {};
        if (prodData.products) {
            prodData.products.forEach(p => {
                productsMap[p.id] = {
                    name: p.name_ar || p.name_en,
                    purchase_price: parseFloat(p.purchase_price || 0),
                    sku: p.sku
                };
            });
        }

        return res.status(200).json({
            invoices: invData.invoices || [],
            productsMap: productsMap,
            product_units: unitsList
        });

    } catch (err) {
        console.error("SERVER ERROR:", err);
        // إرجاع رسالة خطأ JSON صحيحة ليفهمها المتصفح
        return res.status(500).json({ error: err.message || "حدث خطأ غير معروف في السيرفر" });
    }
}
