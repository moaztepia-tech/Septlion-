grant update(status,version,"updatedAt") on core."TradeTransaction" to service_role;
grant update(status,"completedAt","updatedAt") on core."TradeMilestone" to service_role;
grant insert on core."TradeEvent",core."Notification" to service_role;
grant update("knownFacts") on core."QualifiedRequirement" to service_role;
grant select,insert,update on core."BuyerProfile",core."BuyerContact" to service_role;
grant update(name,country,"updatedAt") on core."Organization" to service_role;
grant update("firstName","updatedAt") on core."User" to service_role;
notify pgrst,'reload schema';
