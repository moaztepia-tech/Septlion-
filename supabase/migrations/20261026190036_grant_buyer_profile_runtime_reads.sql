grant select on core."BuyerProfile",core."BuyerContact" to service_role;
notify pgrst,'reload schema';
