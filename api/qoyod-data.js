// ملف: api/qoyod-data.js

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ 
            error: "API Key missing",
            message: "يرجى إضافة QOYOD_API_KEY في ملف .env.local"
        });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    try {
        // حساب تاريخ البداية (4 أشهر للخلف)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 4);
        
        const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log(`جلب الفواتير من ${startDateStr} إلى ${endDateStr}`);

        const urls = [
            // جلب جميع الفواتير (Paid و Partially Paid و Overdue) من آخر 4 أشهر
            `https://api.qoyod.com/2.0/invoices?q[issue_date_gteq]=${startDateStr}&q[issue_date_lteq]=${endDateStr}&q[s]=issue_date+desc&limit=5000`,
            
            // المنتجات
            `https://api.qoyod.com/2.0/products?limit=3000`,
            
            // الوحدات
            `https://api.qoyod.com/2.0/product_units?limit=1000`,
            
            // إشعارات الدائن (المرتجعات)
            `https://api.qoyod.com/2.0/credit_notes?q[issue_date_gteq]=${startDateStr}&q[s]=issue_date+desc&limit=2000`
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
                creditNotesCount: 0,
                dateRange: {
                    start: startDateStr,
                    end: endDateStr
                }
            }
        };

        // معالجة الفواتير
        if (results[0].status === "fulfilled" && results[0].value.ok) {
            const invData = await results[0].value.json();
            data.invoices = invData.invoices || [];
            data.stats.invoicesCount = data.invoices.length;
            
            // إحصائيات حسب الحالة
            data.stats.paidCount = data.invoices.filter(i => i.status === 'Paid').length;
            data.stats.unpaidCount = data.invoices.filter(i => i.status !== 'Paid').length;
            
            console.log(`✓ تم جلب ${data.stats.invoicesCount} فاتورة (مدفوعة: ${data.stats.paidCount}، غير مدفوعة: ${data.stats.unpaidCount})`);
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
                    sku: p.sku || "",
                    id: p.id
                };
            });
            data.stats.productsCount = Object.keys(data.productsMap).length;
            console.log(`✓ تم جلب ${data.stats.productsCount} منتج`);
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
            console.log(`✓ تم جلب ${data.stats.unitsCount} وحدة قياس`);
        } else {
            data.errors.push({
                source: "product_units",
                message: results[2].reason?.message || "فشل في جلب الوحدات"
            });
        }

        // معالجة إشعارات الدائن (المرتجعات)
        if (results[3].status === "fulfilled" && results[3].value.ok) {
            const cData = await results[3].value.json();
            data.credit_notes = cData.credit_notes || [];
            data.stats.creditNotesCount = data.credit_notes.length;
            console.log(`✓ تم جلب ${data.stats.creditNotesCount} إشعار دائن`);
        } else {
            data.errors.push({
                source: "credit_notes",
                message: results[3].reason?.message || "فشل في جلب إشعارات الدائن"
            });
        }

        // إذا فشلت جميع الطلبات
        if (data.errors.length === 4) {
            return res.status(500).json({
                error: "فشل في جلب جميع البيانات من Qoyod API",
                details: data.errors
            });
        }

        // إضافة ملخص
        data.summary = {
            success: true,
            message: `تم جلب البيانات بنجاح من ${startDateStr} إلى ${endDateStr}`,
            totalInvoices: data.stats.invoicesCount,
            paidInvoices: data.stats.paidCount,
            unpaidInvoices: data.stats.unpaidCount,
            totalProducts: data.stats.productsCount,
            totalReturns: data.stats.creditNotesCount
        };

        return res.status(200).json(data);

    } catch (err) {
        console.error("خطأ غير متوقع:", err);
        return res.status(500).json({ 
            error: err.message,
            message: "حدث خطأ غير متوقع أثناء جلب البيانات"
        });
    }
}
