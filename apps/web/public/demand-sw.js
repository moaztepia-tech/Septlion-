self.addEventListener('push',event=>{
  event.waitUntil(self.registration.showNotification('Septlion — RFQ جديد',{
    body:'وصل طلب عرض سعر جديد إلى محرك الطلب. افتح Workbench للمراجعة.',
    icon:'/brand/septlion-primary-navy.png',
    badge:'/brand/septlion-primary-navy.png',
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
