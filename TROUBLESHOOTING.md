# 🔧 حل مشكلة "فشل تحميل البيانات"

## ❌ المشكلة
```
خطأ: فشل تحميل البيانات
```

---

## ✅ الحلول خطوة بخطوة

### 1️⃣ تحقق من مفتاح API

#### في Vercel:
```
Settings → Environment Variables → تحقق من:
- الاسم بالضبط: QOYOD_API_KEY
- القيمة موجودة وصحيحة
- Environment: Production ☑
```

#### في قيود:
1. سجل دخول → الإعدادات → الإعدادات العامة
2. قسم "API Key"
3. تأكد أن المفتاح **نشط** وليس محذوف
4. إذا لزم، أنشئ مفتاح جديد

---

### 2️⃣ تحقق من صلاحيات API

#### المفتاح يحتاج صلاحيات:
- ✅ قراءة الفواتير (Invoices)
- ✅ قراءة المنتجات (Products)
- ✅ قراءة الوحدات (Product Units)
- ✅ قراءة إشعارات الدائن (Credit Notes)

#### كيف تتحقق:
1. قيود → الإعدادات → API Key
2. تأكد أن الصلاحيات شاملة
3. إذا محدودة → أنشئ مفتاح جديد بصلاحيات كاملة

---

### 3️⃣ تحقق من الكود

#### ملف `api/qoyod-data.js` يجب أن يحتوي:

```javascript
const headers = {
    "API-KEY": API_KEY  // ليس "Authorization" أو غيره
};

// الطلب الصحيح
fetch(url, { 
    method: 'GET',
    headers: headers,
    redirect: 'follow'
})
```

#### ❌ خطأ شائع:
```javascript
// خطأ - لا تستخدم هذا
"Authorization": `Bearer ${API_KEY}`  // خطأ!
"Content-Type": "application/json"     // غير مطلوب في GET
```

#### ✅ الصحيح:
```javascript
// صحيح - استخدم هذا
const headers = {
    "API-KEY": API_KEY
};
```

---

### 4️⃣ اختبار مفتاح API يدوياً

#### استخدم هذا الكود للاختبار:

```javascript
// في Console المتصفح (F12)
fetch('https://api.qoyod.com/2.0/invoices?limit=1', {
    headers: { 'API-KEY': 'ضع-مفتاحك-هنا' }
})
.then(r => r.json())
.then(d => console.log('النتيجة:', d))
.catch(e => console.error('الخطأ:', e));
```

#### النتائج المتوقعة:

✅ **نجح:**
```json
{
  "invoices": [...]
}
```

❌ **فشل:**
```json
{
  "error": "Unauthorized"
}
```
→ المفتاح خاطئ أو غير نشط

---

### 5️⃣ تحقق من URLs

#### التنسيق الصحيح حسب توثيق قيود:

```javascript
// ✅ صحيح
https://api.qoyod.com/2.0/invoices?limit=100
https://api.qoyod.com/2.0/products?limit=100
https://api.qoyod.com/2.0/product_units?limit=100
https://api.qoyod.com/2.0/credit_notes?limit=100

// ❌ خطأ
https://api.qoyod.com/v2/invoices        // v2 بدلاً من 2.0
https://api.qoyod.com/2.0/invoice        // invoice بدون s
```

---

### 6️⃣ فحص Logs في Vercel

#### الخطوات:
1. Vercel Dashboard → المشروع
2. اختر آخر Deployment
3. تبويب **"Logs"** أو **"Functions"**
4. ابحث عن رسائل الأخطاء

#### أخطاء شائعة في Logs:

```
❌ "API Key missing"
   → المفتاح غير موجود في Environment Variables

❌ "HTTP 401: Unauthorized"
   → مفتاح API خاطئ أو غير نشط

❌ "HTTP 403: Forbidden"
   → المفتاح ليس لديه صلاحيات كافية

❌ "HTTP 404: Not Found"
   → URL خاطئ

❌ "HTTP 429: Too Many Requests"
   → تجاوزت حد الطلبات (انتظر قليلاً)

❌ "HTTP 500: Internal Server Error"
   → مشكلة في خادم قيود (جرب لاحقاً)
```

---

### 7️⃣ اختبار محلي

#### إذا كان لديك Node.js:

```javascript
// test-api.js
const API_KEY = 'ضع-مفتاحك-هنا';

fetch('https://api.qoyod.com/2.0/invoices?limit=1', {
    headers: { 'API-KEY': API_KEY }
})
.then(r => {
    console.log('Status:', r.status);
    return r.json();
})
.then(d => console.log('Data:', JSON.stringify(d, null, 2)))
.catch(e => console.error('Error:', e));
```

```bash
node test-api.js
```

---

### 8️⃣ تحديث ملف API

#### استخدم الملف المصحح:

استبدل محتوى `api/qoyod-data.js` بـ:

```javascript
export default async function handler(req, res) {
    const API_KEY = process.env.QOYOD_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ 
            error: "API Key missing",
            message: "أضف QOYOD_API_KEY في Vercel Settings"
        });
    }

    const headers = {
        "API-KEY": API_KEY  // الطريقة الصحيحة
    };

    try {
        const response = await fetch(
            'https://api.qoyod.com/2.0/invoices?limit=10',
            { 
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return res.status(200).json({
            success: true,
            invoices: data.invoices || [],
            count: (data.invoices || []).length
        });

    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ 
            error: err.message,
            message: "فشل في جلب البيانات"
        });
    }
}
```

---

### 9️⃣ إعادة النشر

#### بعد أي تعديل:

```bash
# في مجلد المشروع
git add .
git commit -m "fix: API endpoint"
git push

# أو في Vercel Dashboard
Deployments → ... → Redeploy
```

---

### 🔟 التحقق النهائي

#### Checklist:

- [ ] مفتاح API صحيح ونشط
- [ ] المفتاح في Vercel Settings (QOYOD_API_KEY)
- [ ] Environment: Production ☑
- [ ] Headers صحيحة (`API-KEY` وليس `Authorization`)
- [ ] URLs صحيحة (`2.0` وليس `v2`)
- [ ] تم إعادة النشر بعد التعديل
- [ ] لا توجد أخطاء في Logs

---

## 🧪 اختبار سريع

### افتح Console في المتصفح (F12):

```javascript
// اختبار API مباشرة
fetch('/api/qoyod-data')
    .then(r => r.json())
    .then(d => {
        console.log('نجح!', d);
        if (d.invoices && d.invoices.length > 0) {
            console.log('✅ عدد الفواتير:', d.invoices.length);
        } else {
            console.log('⚠️ لا توجد فواتير');
        }
    })
    .catch(e => console.error('❌ فشل:', e));
```

---

## 📋 أمثلة على الأخطاء والحلول

### خطأ 1: "API Key missing"
```json
{
  "error": "API Key missing",
  "message": "أضف QOYOD_API_KEY في Vercel Settings"
}
```
**الحل:** أضف المفتاح في Vercel → Settings → Environment Variables

---

### خطأ 2: "HTTP 401"
```json
{
  "error": "HTTP 401: Unauthorized"
}
```
**الحل:** المفتاح خاطئ، احصل على مفتاح جديد من قيود

---

### خطأ 3: "HTTP 404"
```json
{
  "error": "HTTP 404: Not Found"
}
```
**الحل:** تحقق من URL، يجب أن يكون `2.0` وليس `v2`

---

### خطأ 4: لا توجد بيانات
```json
{
  "invoices": [],
  "count": 0
}
```
**الحل:** 
- ✅ API يعمل لكن لا توجد فواتير
- جرّب شهر مختلف أو تحقق من قيود مباشرة

---

## 🎯 النتيجة المتوقعة

### عند النجاح:
```json
{
  "success": true,
  "invoices": [...],
  "productsMap": {...},
  "product_units": [...],
  "credit_notes": [...],
  "stats": {
    "invoicesCount": 50,
    "paidCount": 30,
    "unpaidCount": 20
  }
}
```

---

## 📞 إذا استمرت المشكلة

1. **التقط لقطة شاشة** من:
   - رسالة الخطأ
   - Vercel Logs
   - Console في المتصفح

2. **جرّب الاختبار اليدوي:**
   ```bash
   curl -H "API-KEY: your-key-here" \
        https://api.qoyod.com/2.0/invoices?limit=1
   ```

3. **تواصل مع دعم قيود:**
   - تأكد أن API نشط لحسابك
   - تأكد من الصلاحيات

---

**✅ بعد تطبيق هذه الخطوات، يجب أن يعمل النظام بشكل طبيعي!**
