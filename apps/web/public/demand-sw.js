self.addEventListener('push',event=>{
  event.waitUntil(self.registration.showNotification('سبتليون — طلب جديد من مشتري',{
    body:'وصل طلب جديد من الموقع. اضغط هنا لفتحه والرد على المشتري.',
    icon:'/brand/notify-icon-192.png',
    badge:'/brand/notify-badge-96.png',
    dir:'rtl',
    lang:'ar',
    vibrate:[200,100,200],
    tag:'septlion-new-rfq',
    renotify:true,
    requireInteraction:true,
    data:{url:'/demand-intelligence/workbench/'}
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/demand-intelligence/workbench/',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('focus' in client){
        if('navigate' in client)client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
