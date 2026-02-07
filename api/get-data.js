import fetch from 'node-fetch';

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    const targetMonth = req.query.month; // استقبال الشهر من الرابط

    // 1. التحقق من المفتاح
    if (!API_KEY) {
        return res.status(500).json({ error: "API Key مفقود في إعدادات السيرفر" });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
        // 2. إعداد فلتر التاريخ (ليجلب السيرفر بيانات هذا الشهر فقط)
        let dateParams = "";
        if (targetMonth) {
            const [year, month] = targetMonth.split('-');
            const startDate = `${year}-${month}-01`;
            // حساب آخر يوم في الشهر تلقائياً
            const lastDay = new Date(year, month, 0).getDate(); 
            const endDate = `${year}-${month}-${lastDay}`;
            
            // صيغة الفلتر الخاصة بـ Qoyod API V2
            dateParams = `&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}`;
        }

        // 3. روابط البيانات (مع رفع الحد الأقصى لضمان جلب الكل)
        // الفواتير: المدفوعة والمعتمدة فقط
        const invUrl = `https://api.qoyod.com/2.0/invoices?q[status_in][]=Paid&q[status_in][]=Approved${dateParams}&limit=2500`;
        
        // المنتجات: لجلب أسعار الشراء
        const prodUrl = "https://api.qoyod.com/2.0/products?limit=2500";
        
        // الوحدات: لجلب تحويلات الكرتون (تم رفع الحد لضمان عدم ضياع أي وحدة)
        const unitsUrl = "https://api.qoyod.com/2.0/product_units?limit=1000";

        // 4. التنفيذ المتوازي (جلب الكل في نفس اللحظة للسرعة)
        const [invRes, prodRes, unitsRes] = await Promise.all([
            fetch(invUrl, { headers }),
            fetch(prodUrl, { headers }),
            fetch(unitsUrl, { headers }).catch(e => null) // لا يوقف النظام لو فشلت الوحدات
        ]);

        // 5. التحقق من الأخطاء
        if (!invRes.ok) {
            const txt = await invRes.text();
            throw new Error(`فشل جلب الفواتير: ${txt}`);
        }
        if (!prodRes.ok) {
            const txt = await prodRes.text();
            throw new Error(`فشل جلب المنتجات: ${txt}`);
        }

        // 6. استخراج البيانات
        const invData = await invRes.json();
        const prodData = await prodRes.json();
        
        // معالجة الوحدات
        let unitsList = [];
        if (unitsRes && unitsRes.ok) {
            const unitsData = await unitsRes.json();
            unitsList = unitsData.product_units || [];
        }

        // تجهيز خريطة المنتجات (للسرعة في البحث)
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

        // 7. الرد النهائي للواجهة
        return res.status(200).json({
            invoices: invData.invoices || [],
            productsMap: productsMap,
            product_units: unitsList // <--- هنا الوحدات موجودة
        });

    } catch (err) {
        console.error("SERVER ERROR:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
