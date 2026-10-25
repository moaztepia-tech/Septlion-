import {test,expect} from '@playwright/test';

async function browserSession(page,token){await page.addInitScript(token=>{if(!localStorage.getItem('septlion_session'))localStorage.setItem('septlion_session',JSON.stringify({access_token:token,refresh_token:'fixture',session_key:'browser',expires_at:4102444800,user:{id:'fixture'}}))},token)}
test('360px ADMIN draft/publication and BUYER discovery-to-RFQ flow with server authorization',async({page,context})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/command-center');
 await expect(page.getByRole('heading',{name:'الدخول إلى مركز القيادة'})).toBeVisible();await expect(page.getByText('ماذا تريد أن تنجز؟')).toHaveCount(0);
 const denied=await context.request.post('/api/command-session',{headers:{origin:'http://localhost:3200'},data:{token:'BUYER'}});expect(denied.status()).toBe(403);
 const cross=await context.request.post('/api/command-session',{headers:{origin:'https://attacker.invalid'},data:{token:'ADMIN'}});expect(cross.status()).toBe(403);
 await browserSession(page,'ADMIN');await page.reload();await page.getByRole('button',{name:'متابعة بالحساب الحالي'}).click();
 await expect(page.getByText('ماذا تريد أن تنجز؟')).toBeVisible();
 const cookies=await context.cookies();const cookie=cookies.find(c=>c.name==='septlion_command_access');expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Strict');
 await page.getByLabel('اسم المنتج',{exact:true}).fill('زيت زولانا');await page.getByLabel('رمز الرابط').fill('zollana-oil');await page.getByRole('combobox',{name:'القطاع',exact:true}).selectOption('food');await page.getByLabel('الوصف',{exact:true}).fill('زيت عباد الشمس · تُثبت المواصفة في العرض');await page.getByLabel('رمز الصنف').fill('ZO-OIL-1');await page.getByLabel('اسم التعبئة').fill('عبوة 1 لتر');await page.getByLabel('مواصفة التعبئة').fill('1 لتر × 12');
 await page.getByRole('button',{name:'حفظ كمسودة خاصة'}).click();await expect(page.getByText('DRAFT · PRIVATE')).toBeVisible();
 await page.getByRole('button',{name:'مراجعة النشر'}).click();await expect(page.getByRole('button',{name:'تأكيد النشر'})).toBeDisabled();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'تأكيد النشر'}).click();await expect(page.getByText('ACTIVE · PUBLIC')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/command-center-360.png',fullPage:true});

 // Continue in the same browser context, switching to a buyer session.
 await page.evaluate(()=>localStorage.setItem('septlion_session',JSON.stringify({access_token:'BUYER',refresh_token:'fixture',session_key:'buyer',expires_at:4102444800,user:{id:'buyer'}})));
 await page.goto('/discover');
 await expect(page.getByRole('heading',{name:'زيت زولانا',exact:true})).toBeVisible();await page.getByLabel('حاويات عبوة 1 لتر').fill('2');const track=await page.locator('.discover-scale').boundingBox(),marker=await page.locator('.discover-scale i').boundingBox();expect(marker.x).toBeLessThan(track.x+track.width/2);await page.getByRole('button',{name:'L/C',exact:true}).click();await page.getByRole('button',{name:/حدد ميناء الوصول/}).click();await page.getByRole('button',{name:/Dar es Salaam/}).click();await page.getByRole('button',{name:'اطلب هذا الصنف'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByLabel('الاسم',{exact:true}).fill('معاذ إبراهيم');await dialog.getByLabel('الشركة',{exact:true}).fill('TEST Septlion');await dialog.getByLabel('رقم WhatsApp مع رمز الدولة').fill('+201012345678');await expect(dialog.getByLabel('الاسم',{exact:true})).toHaveValue('معاذ إبراهيم');await expect(dialog.getByLabel('الشركة',{exact:true})).toHaveValue('TEST Septlion');
 await dialog.getByRole('button',{name:'طلب عرض سعر',exact:true}).click();await expect(page.getByRole('status')).toContainText('تم استلام طلب عرض السعر');await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(/\/discover$/);
 const observations=await (await page.request.get('http://127.0.0.1:3299/observations')).json();expect(observations.requests).toHaveLength(1);expect(observations.requests[0].variants).toEqual([{skuId:'sku-0',containers:2}]);expect(observations.requests[0].idempotencyKey).toBeTruthy();expect(observations.requests[0].paymentPreference).toBe('L/C');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/discover-360.png',fullPage:true});
});
