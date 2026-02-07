import fetch from 'node-fetch';

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month; // استقبال الشهر من الرابط

    // 1. التأكد من وجود المفتاح
    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing. Check Vercel Environment Variables." });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
        // --- إعداد تواريخ الفلترة بدقة ---
        let startDate = "";
        let endDate = "";

        if (targetMonth) {
            const [year, month] = targetMonth.split('-');
            // اليوم الأول
            startDate = `${year}-${month}-01`;
            // اليوم الأخير (حيلة برمجية: اليوم 0 من الشهر القادم هو آخر يوم في الشهر الحالي)
            // نستخدم new Date للتأكد من عدد أيام الشهر (28، 30، أو 31)
            const lastDay = new Date(year, month, 0).getDate(); 
            endDate = `${year}-${month}-${lastDay}`;
        }

        // --- بناء الروابط بشكل آمن (URL Construction) ---
        // نستخدم URLSearchParams لضمان أن الأقواس [] والرموز تُرسل بشكل صحيح 100%
        
        // 1. رابط الفواتير
        const invParams = new URLSearchParams();
        invParams.append("q[status_in][]", "Paid");
        invParams.append("q[status_in][]", "Approved");
        invParams.append("limit", "2000"); // حد آمن جداً لشهر واحد

        if (startDate && endDate) {
            invParams.append("q[issue_date_gteq]", startDate); // أكبر من أو يساوي البداية
            invParams.append("q[issue_date_lteq]", endDate);   // أصغر من أو يساوي النهاية
        }

        const invUrl = `https://www.qoyod.com/api/2.0/invoices?${invParams.toString()}`;

        // 2. رابط المنتجات
        const prodUrl = "https://www.qoyod.com/api/2.0/products?limit=2000";

        // 3. رابط الوحدات
        const unitsUrl = "https://www.qoyod.com/api/2.0/product_units?limit=500";

        // --- تنفيذ الطلبات ---
        // console.log("Fetching URL:", invUrl); // (لأغراض التصحيح في سجلات Vercel)

        const [invRes, prodRes, unitsRes] = await Promise.all([
            fetch(invUrl, { headers }),
            fetch(prodUrl, { headers }),
            fetch(unitsUrl, { headers }).catch(e => ({ ok: false }))
        ]);

        if (!invRes.ok) {
            const errText = await invRes.text();
            throw new Error(`خطأ في جلب الفواتير من قيود: ${invRes.status} - ${errText}`);
        }
        if (!prodRes.ok) {
            throw new Error("خطأ في جلب المنتجات من قيود");
        }

        const invData = await invRes.json();
        const prodData = await prodRes.json();
        
        // جلب الوحدات إذا نجح
        let unitsList = [];
        if (unitsRes.ok) {
            const unitsData = await unitsRes.json();
            unitsList = unitsData.product_units || [];
        }

        // تجهيز خريطة المنتجات
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

        // إرجاع البيانات
        return res.status(200).json({
            invoices: invData.invoices || [],
            productsMap: productsMap,
            product_units: unitsList,
            debug_date: { start: startDate, end: endDate } // للتأكد من التاريخ
        });

    } catch (err) {
        console.error("SERVER ERROR:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
