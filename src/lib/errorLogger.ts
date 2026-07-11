import { supabase } from "./supabase";

export const logClientError = async (
  message: string,
  stack?: string,
  route?: string,
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("client_errors").insert({
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 5000),
      route: route ?? window.location.pathname,
      user_id: user?.id ?? null,
      user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch {
    // Logging must never throw or surface to the user
  }
};
