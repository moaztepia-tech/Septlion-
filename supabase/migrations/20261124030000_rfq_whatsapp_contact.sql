-- Let a buyer send a request with a WhatsApp number instead of an email address.
-- The customer site sends requests straight to the team without asking for an
-- email code first: name, company and WhatsApp number are enough, and the email
-- becomes optional. At least one way to reach the buyer is still required.
-- Same function as 20260930223946, with only those checks changed and the
-- submission's source channel recorded.

ALTER TABLE public."DemandRfqSubmission" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE public."DemandRfqSubmission" DROP CONSTRAINT IF EXISTS "DemandRfqSubmission_contact_check";
ALTER TABLE public."DemandRfqSubmission" ADD CONSTRAINT "DemandRfqSubmission_contact_check"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION public.create_public_demand_rfq(payload JSONB)
RETURNS TABLE (
  submission_id UUID,
  signal_id UUID,
  reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_id UUID := gen_random_uuid();
  sig_id UUID := gen_random_uuid();
  ref TEXT := 'SRFQ-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(sub_id::text,'-',''),1,8));
  origin_signal UUID;
  origin_page RECORD;
  product_key TEXT := nullif(trim(payload->>'productKey'),'');
  product_name TEXT := nullif(trim(payload->>'product'),'');
  company_name TEXT := nullif(trim(payload->>'companyName'),'');
  contact_name TEXT := nullif(trim(payload->>'contactName'),'');
  email_value TEXT := lower(nullif(trim(payload->>'email'),''));
  phone_value TEXT := nullif(trim(payload->>'phone'),'');
  channel_value TEXT := coalesce(nullif(trim(payload->>'channel'),''),'public_intent_form');
  country_value TEXT := nullif(trim(payload->>'country'),'');
  quantity_value TEXT := nullif(trim(payload->>'quantity'),'');
  intent_slug TEXT := nullif(trim(payload->>'intentSlug'),'');
  score_value INTEGER := 65;
BEGIN
  IF product_key IS NULL OR product_name IS NULL OR company_name IS NULL
     OR contact_name IS NULL OR (email_value IS NULL AND phone_value IS NULL)
     OR country_value IS NULL OR quantity_value IS NULL THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;

  IF email_value IS NOT NULL AND email_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  IF email_value IS NULL AND phone_value !~ '^\+?[0-9 ]{8,20}$' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  IF intent_slug IS NOT NULL THEN
    SELECT ip.*, dip."signalId" AS origin_signal_id
    INTO origin_page
    FROM "PublicDemandIntentPage" ip
    JOIN "DemandIntentPage" dip ON dip."id"=ip."id"
    WHERE ip."slug"=intent_slug
    LIMIT 1;

    IF FOUND THEN
      origin_signal := origin_page.origin_signal_id;
      IF origin_page."productKey" IS NOT NULL THEN product_key := origin_page."productKey"; END IF;
      IF origin_page."title" IS NOT NULL THEN product_name := origin_page."title"; END IF;
    END IF;
  END IF;

  IF nullif(trim(payload->>'phone'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'destinationPort'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'packing'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'incoterm'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'deliveryWindow'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  score_value := least(score_value,95);

  INSERT INTO "DemandSignal"
    ("id","source","sourceRecordId","sourceUrl","type","status","stage","market","product","productKey",
     "quantity","buyerName","publishedAt","deadlineAt","incoterm","packing","evidence","score","verification",
     "intentPageCandidate","raw","lastSeenAt")
  VALUES
    (
      sig_id,
      'Septlion Intent Page',
      ref,
      CASE WHEN intent_slug IS NULL THEN 'https://septlion.com/intent/wheat-flour/'
           ELSE 'https://septlion.com/intent/demand/?slug=' || intent_slug END,
      'RFQ',
      'QUALIFY_NOW',
      'RFQ',
      country_value ||
        CASE WHEN nullif(trim(payload->>'destinationPort'),'') IS NULL
          THEN '' ELSE ' — ' || trim(payload->>'destinationPort') END,
      product_name,
      product_key,
      quantity_value,
      company_name,
      now(),
      NULL,
      nullif(trim(payload->>'incoterm'),''),
      nullif(trim(payload->>'packing'),''),
      jsonb_build_object(
        'inbound',true,
        'contactName',contact_name,
        'email',email_value,
        'phone',nullif(trim(payload->>'phone'),''),
        'city',nullif(trim(payload->>'city'),''),
        'deliveryWindow',nullif(trim(payload->>'deliveryWindow'),''),
        'originSignalId',origin_signal,
        'intentSlug',intent_slug
      ),
      score_value,
      'BUYER_SELF_SUBMITTED',
      false,
      jsonb_build_object('submission',payload - 'ipHash' - 'userAgent'),
      now()
    );

  INSERT INTO "DemandRfqSubmission"
    ("id","reference","intentSlug","originSignalId","signalId","status","productKey","product",
     "companyName","contactName","email","phone","country","city","destinationPort","quantity",
     "packing","incoterm","deliveryWindow","notes","ipHash","userAgent","metadata")
  VALUES
    (
      sub_id,ref,intent_slug,origin_signal,sig_id,'RECEIVED',product_key,product_name,
      company_name,contact_name,email_value,nullif(trim(payload->>'phone'),''),
      country_value,nullif(trim(payload->>'city'),''),
      nullif(trim(payload->>'destinationPort'),''),
      quantity_value,nullif(trim(payload->>'packing'),''),
      nullif(trim(payload->>'incoterm'),''),
      nullif(trim(payload->>'deliveryWindow'),''),
      nullif(trim(payload->>'notes'),''),
      nullif(trim(payload->>'ipHash'),''),
      left(coalesce(payload->>'userAgent',''),500),
      jsonb_build_object('source',channel_value)
    );

  INSERT INTO "DemandBuyerResolution"
    ("signalId","buyerName","legalEntity","country","contactName","businessEmail","businessPhone",
     "confidence","verificationStatus","evidence")
  VALUES
    (
      sig_id,company_name,company_name,country_value,contact_name,email_value,
      nullif(trim(payload->>'phone'),''),
      70,'BUYER_SELF_SUBMITTED',
      jsonb_build_object('rfqReference',ref,'intentSlug',intent_slug)
    )
  ON CONFLICT ("signalId") DO NOTHING;

  INSERT INTO "DemandOpportunityEvent"
    ("signalId","stage","eventType","note","metadata")
  VALUES
    (sig_id,'RFQ','INBOUND_RFQ_RECEIVED',
     'Buyer submitted an RFQ from a Septlion intent page.',
     jsonb_build_object('reference',ref,'originSignalId',origin_signal,'intentSlug',intent_slug));

  RETURN QUERY SELECT sub_id,sig_id,ref;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_demand_rfq(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_demand_rfq(JSONB) TO service_role;
