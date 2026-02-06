CREATE TABLE IF NOT EXISTS "AllowedUser" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" varchar(255) NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "AllowedUser_email_unique" UNIQUE("email")
);

CREATE OR REPLACE FUNCTION public.check_if_user_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public."AllowedUser" WHERE "email" = NEW.email) THEN
        RAISE EXCEPTION 'This user email is not allowed to register.';
END IF;
RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_public_user_created
    BEFORE INSERT ON public."User"
    FOR EACH ROW EXECUTE FUNCTION public.check_if_user_allowed();