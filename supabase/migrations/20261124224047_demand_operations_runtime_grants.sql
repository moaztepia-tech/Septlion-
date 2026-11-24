-- The authenticated Edge workbench runs as service_role, not database owner.
-- Keep bridge/engine functions SECURITY INVOKER; grant only backend intelligence operations.
GRANT SELECT,INSERT,UPDATE ON core."DemandSignal",core."QualifiedRequirement",core."Opportunity",
 core."BuyerProfile",core."AgentRun",core."SupplyCandidate" TO service_role;
GRANT SELECT,UPDATE ON public."DemandSignal",public."DemandQualification",public."DemandOfferBuild",public."DemandTask" TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."DemandSupplierFit" TO service_role;
GRANT SELECT,INSERT,UPDATE ON public."DemandPattern" TO service_role;
GRANT SELECT,INSERT ON public."DemandAlert" TO service_role;
GRANT SELECT ON public."DemandBuyerResolution",public."DemandSupplierProfile",public."DemandRfqSubmission",
 public."DemandSource",public."DemandBuyerSignal",public."DemandBuyerProfile" TO service_role;
