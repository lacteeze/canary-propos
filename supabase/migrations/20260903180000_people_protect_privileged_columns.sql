-- B2: block self-promotion and privilege changes on people unless service_role.
CREATE OR REPLACE FUNCTION public.people_protect_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.invite_token IS DISTINCT FROM OLD.invite_token
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot change privileged people columns';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_protect_privileged_columns ON public.people;
CREATE TRIGGER people_protect_privileged_columns
  BEFORE UPDATE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.people_protect_privileged_columns();
