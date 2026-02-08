export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month; // الصيغة المتوقعة: YYYY-MM

    // 1. التحقق من وجود مفتاح الربط
    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing in Vercel Settings" });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
        // 2. ضبط النطاق الزمني (الشهر المختار + شهرين سابقين = 3 أشهر)
        let dateParams = "";
        if (targetMonth) {
            const [year, month] = targetMonth.split('-').map(Number);
            
            // بداية النطاق: الأول من الشهر (قبل شهرين من الشهر المختار)
            const startDay = new Date(year, month - 3, 1);
            const startDate = startDay.toISOString().split('T')[0];
            
            // نهاية النطاق: آخر يوم في الشهر المختار
            const endDay = new Date(year, month, 0);
            const endDate = endDay.toISOString().split('T')[0];
            
            // تصفية النتائج من المصدر لتقليل الحمل
            dateParams = `&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}`;
        }

        // 3. روابط API قيود (الإصدار الثاني V2)
        const urls = [
            // أ) الفواتير: نجلب المدفوعة (للحساب) والمعتمدة (للمعلق)
            `https://api.qoyod.com/2.0/invoices?q[status_in][]=Paid&q[status_in][]=Approved${dateParams}&limit=2500`,
            
            // ب) المنتجات: لجلب الأسعار الأساسية والأسماء
            `https://api.qoyod.com/2.0/products?limit=2500`,
            
            // ج) الوحدات: لجلب معامل تحويل الكرتون
            `https://api.qoyod.com/2.0/product_units?limit=1000`,

            // د) الإشعارات الدائنة: لخصم المرتجعات بدقة (الجديد في V18)
            `https://api.qoyod.com/2.0/credit_notes?${dateParams}&limit=1000`
        ];

        // 4. التنفيذ المتوازي (تسريع العملية)
        const results = await Promise.allSettled(urls.map(url => fetch(url, { headers })));

        // 5. معالجة النتائج وتجميع البيانات
        const data = { 
            invoices: [], 
            productsMap: {}, 
            product_units: [], 
            credit_notes: [] 
        };

        // معالجة الفواتير
        if (results[0].status === 'fulfilled' && results[0].value.ok) {
            const json = await results[0].value.json();
            data.invoices = json.invoices || [];
        } else if (results[0].status === 'rejected') {
            throw new Error("فشل جلب الفواتير");
        }

        // معالجة المنتجات (تحويلها لـ Map لسهولة البحث)
        if (results[1].status === 'fulfilled' && results[1].value.ok) {
            const pData = await results[1].value.json();
            pData.products.forEach(p => {
                data.productsMap[p.id] = { 
                    name: p.name_ar || p.name_en, 
                    purchase_price: parseFloat(p.purchase_price || 0), 
                    sku: p.sku 
                };
            });
        }

        // معالجة الوحدات
        if (results[2].status === 'fulfilled' && results[2].value.ok) {
            const uData = await results[2].value.json();
            data.product_units = uData.product_units || [];
        }

        // معالجة الإشعارات الدائنة
        if (results[3].status === 'fulfilled' && results[3].value.ok) {
            const cData = await results[3].value.json();
            data.credit_notes = cData.credit_notes || [];
        }

        // 6. إرسال الرد النهائي للواجهة
        return res.status(200).json(data);

    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ error: err.message || "حدث خطأ غير متوقع في السيرفر" });
    }
}
