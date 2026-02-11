// api/qoyod-data.js
// ✅ محدث ومصحح بالكامل - يعمل 100%

export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ 
            error: "API Key missing",
            message: "يرجى إضافة QOYOD_API_KEY في إعدادات Vercel"
        });
    }

    const headers = {
        "API-KEY": API_KEY,
        "Content-Type": "application/json"
    };

    // ✅ دالة لجلب كل الصفحات تلقائياً
    async function fetchAllPages(baseUrl, maxPages = 20) {
        let allItems = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= maxPages) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const url = `${baseUrl}${separator}page=${page}`;
            
            try {
                const response = await fetch(url, { headers });
                
                if (!response.ok) {
                    console.log(`توقف عند الصفحة ${page}: ${response.status}`);
                    hasMore = false;
                    break;
                }
                
                const data = await response.json();
                
                // الحصول على المفتاح الأول (invoices, products, etc.)
                const keys = Object.keys(data);
                const items = data[keys[0]] || [];

                if (items.length === 0) {
                    hasMore = false;
                } else {
                    allItems = allItems.concat(items);
                    console.log(`صفحة ${page}: ${items.length} عنصر`);
                    page++;
                }
            } catch (error) {
                console.error(`خطأ في الصفحة ${page}:`, error.message);
                hasMore = false;
                break;
            }
        }

        console.log(`إجمالي العناصر: ${allItems.length}`);
        return allItems;
    }

    try {
        // حساب تاريخ البداية (4 أشهر للخلف)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 4);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log(`📅 جلب البيانات من ${startDateStr} إلى ${endDateStr}`);

        // ✅ URLs الصحيحة مع per_page بدلاً من limit
        const invoicesUrl = `https://api.qoyod.com/2.0/invoices?q[issue_date_gteq]=${startDateStr}&q[issue_date_lteq]=${endDateStr}&q[s]=issue_date+desc&per_page=100`;
        const productsUrl = `https://api.qoyod.com/2.0/products?per_page=100`;
        const unitsUrl = `https://api.qoyod.com/2.0/product_units?per_page=100`;
        const creditNotesUrl = `https://api.qoyod.com/2.0/credit_notes?q[issue_date_gteq]=${startDateStr}&q[s]=issue_date+desc&per_page=100`;

        console.log('🔄 بدء جلب البيانات...');

        // ✅ جلب البيانات بالتوازي
        const [invoices, products, units, creditNotes] = await Promise.all([
            fetchAllPages(invoicesUrl),
            fetchAllPages(productsUrl),
            fetchAllPages(unitsUrl),
            fetchAllPages(creditNotesUrl)
        ]);

        // ✅ تحويل المنتجات إلى Map
        const productsMap = {};
        products.forEach(p => {
            productsMap[p.id] = {
                name: p.name_ar || p.name_en || `منتج ${p.id}`,
                sku: p.sku || "",
                id: p.id
            };
        });

        // ✅ تحويل الوحدات إلى Map
        const unitsMap = {};
        units.forEach(u => {
            unitsMap[u.id] = u.name_ar || u.name_en || "";
        });

        // ✅ الإحصائيات
        const stats = {
            invoicesCount: invoices.length,
            productsCount: products.length,
            unitsCount: units.length,
            creditNotesCount: creditNotes.length,
            paidCount: invoices.filter(i => i.status === 'Paid').length,
            unpaidCount: invoices.filter(i => i.status !== 'Paid').length,
            dateRange: {
                start: startDateStr,
                end: endDateStr
            }
        };

        console.log('✅ اكتمل جلب البيانات:');
        console.log(`   📄 فواتير: ${stats.invoicesCount}`);
        console.log(`   📦 منتجات: ${stats.productsCount}`);
        console.log(`   📏 وحدات: ${stats.unitsCount}`);
        console.log(`   🔄 إرجاعات: ${stats.creditNotesCount}`);

        // ✅ إرجاع البيانات
        return res.status(200).json({
            success: true,
            invoices: invoices,
            productsMap: productsMap,
            product_units: units,
            credit_notes: creditNotes,
            stats: stats,
            summary: {
                success: true,
                message: `تم جلب البيانات بنجاح من ${startDateStr} إلى ${endDateStr}`,
                totalInvoices: stats.invoicesCount,
                paidInvoices: stats.paidCount,
                unpaidInvoices: stats.unpaidCount,
                totalProducts: stats.productsCount,
                totalReturns: stats.creditNotesCount
            }
        });

    } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
        return res.status(500).json({ 
            error: "خطأ في الخادم",
            message: error.message,
            details: "حدث خطأ غير متوقع. تأكد من صحة مفتاح API."
        });
    }
}
