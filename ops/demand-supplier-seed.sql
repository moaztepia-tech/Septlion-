-- Public-source research, 25 November 2026. These are research candidates, not approved partners.
-- No price, availability, certifications, MOQ or shipping terms are inferred.
INSERT INTO public."DemandSupplierProfile"(name,"legalName",country,"productKeys",packings,"verificationStatus","baseScore",contact,capabilities)
SELECT 'Five Stars Flour Mills','Five Stars Flour Mills','Egypt',ARRAY['wheat_flour'],ARRAY['50 kg'],'SOURCE_VERIFIED',40,
 '{"email":"fsfm@fivestar.com.eg","salesEmail":"Sales@fivestar.com.eg","phone":"+20224147442","sourceUrl":"https://www.fivestar.com.eg/flour/contact.php"}',
 '{"sourceUrl":"https://www.fivestar.com.eg/flour/products.php","observedAt":"2026-11-25","products":["all-purpose flour","bakery flour","biscuit flour","pasta flour"],"packingClaim":"Industrial flour in 50 kg polypropylene bags","relationshipStatus":"RESEARCH_CANDIDATE","priceStatus":"NOT_OBTAINED","requiresCommercialVerification":true}'
WHERE NOT EXISTS(SELECT 1 FROM public."DemandSupplierProfile" WHERE name='Five Stars Flour Mills');

INSERT INTO public."DemandSupplierProfile"(name,"legalName",country,"productKeys","verificationStatus","baseScore",contact,capabilities)
SELECT 'Al Nada Mills','Al Nada Mills','Egypt',ARRAY['wheat_flour'],'SOURCE_VERIFIED',40,
 '{"email":"info@alnadamills.com","sourceUrl":"https://alnadamills.com/"}',
 '{"sourceUrl":"https://alnadamills.com/","observedAt":"2026-11-25","groupWebsite":"https://www.monairy.com/","products":["wheat flour"],"relationshipStatus":"RESEARCH_CANDIDATE","priceStatus":"NOT_OBTAINED","requiresCommercialVerification":true}'
WHERE NOT EXISTS(SELECT 1 FROM public."DemandSupplierProfile" WHERE name='Al Nada Mills');
