// ملف: api/qoyod-data.js
// API محدث ومصحح للعمل مع قيود

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ 
            error: "API Key missing",
            message: "يرجى إضافة QOYOD_API_KEY في إعدادات Vercel"
        });
    }

    // Headers حسب توثيق قيود
    const headers = {
        "API-KEY": API_KEY
    };

    try {
        // حساب تاريخ البداية (4 أشهر للخلف)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 4);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log(`جلب البيانات من ${startDateStr} إلى ${endDateStr}`);

        // URLs حسب توثيق قيود API v2.0
        const urls = [
            // جلب جميع الفواتير (بدون فلترة Status - سنفلتر في الكود)
            `https://api.qoyod.com/2.0/invoices?q[issue_date_gteq]=${startDateStr}&q[issue_date_lteq]=${endDateStr}&q[s]=issue_date+desc&limit=5000`,
            
            // المنتجات
            `https://api.qoyod.com/2.0/products?limit=3000`,
            
            // الوحدات
            `https://api.qoyod.com/2.0/product_units?limit=1000`,
            
            // إشعارات الدائن (المرتجعات)
            `https://api.qoyod.com/2.0/credit_notes?q[issue_date_gteq]=${startDateStr}&q[s]=issue_date+desc&limit=2000`
        ];

        // تنفيذ الطلبات
        const results = await Promise.allSettled(
            urls.map(url => 
                fetch(url, { 
                    method: 'GET',
                    headers: headers,
                    redirect: 'follow'
                }).then(async response => {
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }
                    return response;
                })
            )
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
                paidCount: 0,
                unpaidCount: 0,
                dateRange: {
                    start: startDateStr,
                    end: endDateStr
                }
            }
        };

        // معالجة الفواتير
        if (results[0].status === "fulfilled" && results[0].value.ok) {
            try {
                const invData = await results[0].value.json();
                data.invoices = invData.invoices || [];
                data.stats.invoicesCount = data.invoices.length;
                
                // إحصائيات حسب الحالة
                data.stats.paidCount = data.invoices.filter(i => i.status === 'Paid').length;
                data.stats.unpaidCount = data.invoices.filter(i => i.status !== 'Paid').length;
                
                console.log(`✓ تم جلب ${data.stats.invoicesCount} فاتورة (مدفوعة: ${data.stats.paidCount})`);
            } catch (parseError) {
                console.error("خطأ في معالجة الفواتير:", parseError);
                data.errors.push({
                    source: "invoices",
                    message: "فشل في معالجة بيانات الفواتير: " + parseError.message
                });
            }
        } else {
            data.errors.push({
                source: "invoices",
                message: results[0].reason?.message || "فشل في جلب الفواتير"
            });
        }

        // معالجة المنتجات
        if (results[1].status === "fulfilled" && results[1].value.ok) {
            try {
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
            } catch (parseError) {
                console.error("خطأ في معالجة المنتجات:", parseError);
                data.errors.push({
                    source: "products",
                    message: "فشل في معالجة بيانات المنتجات"
                });
            }
        } else {
            data.errors.push({
                source: "products",
                message: results[1].reason?.message || "فشل في جلب المنتجات"
            });
        }

        // معالجة الوحدات
        if (results[2].status === "fulfilled" && results[2].value.ok) {
            try {
                const uData = await results[2].value.json();
                data.product_units = uData.product_units || [];
                data.stats.unitsCount = data.product_units.length;
                console.log(`✓ تم جلب ${data.stats.unitsCount} وحدة قياس`);
            } catch (parseError) {
                console.error("خطأ في معالجة الوحدات:", parseError);
                data.errors.push({
                    source: "product_units",
                    message: "فشل في معالجة وحدات القياس"
                });
            }
        } else {
            data.errors.push({
                source: "product_units",
                message: results[2].reason?.message || "فشل في جلب الوحدات"
            });
        }

        // معالجة إشعارات الدائن (المرتجعات)
        if (results[3].status === "fulfilled" && results[3].value.ok) {
            try {
                const cData = await results[3].value.json();
                data.credit_notes = cData.credit_notes || [];
                data.stats.creditNotesCount = data.credit_notes.length;
                console.log(`✓ تم جلب ${data.stats.creditNotesCount} إشعار دائن`);
            } catch (parseError) {
                console.error("خطأ في معالجة الإشعارات:", parseError);
                data.errors.push({
                    source: "credit_notes",
                    message: "فشل في معالجة إشعارات الدائن"
                });
            }
        } else {
            data.errors.push({
                source: "credit_notes",
                message: results[3].reason?.message || "فشل في جلب إشعارات الدائن"
            });
        }

        // إذا فشلت جميع الطلبات
        if (data.errors.length === 4) {
            console.error("فشلت جميع الطلبات:", data.errors);
            return res.status(500).json({
                error: "فشل في جلب جميع البيانات من Qoyod API",
                details: data.errors,
                message: "تأكد من صحة مفتاح API وأنه نشط"
            });
        }

        // إذا نجح واحد على الأقل
        if (data.invoices.length === 0 && data.errors.length > 0) {
            console.warn("تحذير: لم يتم جلب فواتير، قد يكون هناك مشكلة");
        }

        // ملخص النتائج
        data.summary = {
            success: true,
            message: `تم جلب البيانات من ${startDateStr} إلى ${endDateStr}`,
            totalInvoices: data.stats.invoicesCount,
            paidInvoices: data.stats.paidCount,
            unpaidInvoices: data.stats.unpaidCount,
            totalProducts: data.stats.productsCount,
            totalReturns: data.stats.creditNotesCount,
            hasErrors: data.errors.length > 0,
            errorCount: data.errors.length
        };

        return res.status(200).json(data);

    } catch (err) {
        console.error("خطأ غير متوقع:", err);
        return res.status(500).json({ 
            error: "خطأ في الخادم",
            message: err.message,
            details: "حدث خطأ غير متوقع أثناء جلب البيانات. تأكد من صحة مفتاح API.",
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
}
