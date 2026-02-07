import fetch from 'node-fetch';

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    
    // استلام الشهر المطلوب من الرابط (مثلاً 2023-11)
    const targetMonth = req.query.month; 

    if (!API_KEY) {
        return res.status(500).json({ error: "API Key missing" });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
        // --- 1. إعداد تواريخ الفلترة ---
        let dateQuery = "";
        if (targetMonth) {
            // حساب أول يوم وآخر يوم في الشهر المحدد
            const [year, month] = targetMonth.split('-');
            const startDate = `${year}-${month}-01`;
            // خدعة لحساب آخر يوم في الشهر
            const lastDay = new Date(year, month, 0).getDate(); 
            const endDate = `${year}-${month}-${lastDay}`;
            
            // إضافة فلتر التاريخ لرابط قيود
            dateQuery = `&q[issue_date_gteq]=${startDate}&q[issue_date_lteq]=${endDate}`;
        }

        // --- 2. روابط API ---
        
        // أ) الفواتير: نجلب المدفوعة والمعتمدة + فلتر التاريخ + رفع الحد لـ 2000 (للأمان داخل الشهر الواحد)
        const invUrl = `https://www.qoyod.com/api/2.0/invoices?q[status_in][]=Paid&q[status_in][]=Approved${dateQuery}&limit=2000`;

        // ب) المنتجات (لجلب الأسعار الأساسية)
        const prodUrl = "https://www.qoyod.com/api/2.0/products?limit=2000";

        // ج) الوحدات (للربط التلقائي للكرتون)
        const unitsUrl = "https://www.qoyod.com/api/2.0/product_units?limit=500";

        // تنفيذ الطلبات
        const [invRes, prodRes, unitsRes] = await Promise.all([
            fetch(invUrl, { headers }),
            fetch(prodUrl, { headers }),
            fetch(unitsUrl, { headers }).catch(err => ({ ok: false }))
        ]);

        if (!invRes.ok || !prodRes.ok) {
            throw new Error("فشل الاتصال بقيود");
        }

        const invData = await invRes.json();
        const prodData = await prodRes.json();
        
        let unitsList = [];
        if (unitsRes.ok) {
            const unitsData = await unitsRes.json();
            unitsList = unitsData.product_units || [];
        }

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
        console.error("Server Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
