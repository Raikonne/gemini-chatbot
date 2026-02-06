CREATE OR REPLACE TRIGGER on_public_user_created
    BEFORE INSERT ON public."User"
    FOR EACH ROW EXECUTE FUNCTION public.check_if_user_allowed();