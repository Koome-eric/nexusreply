"use client";
import { useClientContext } from "../ClientProvider";
import EmailSetupForm       from "@/components/EmailSetupForm";

export default function ClientEmailSetupPage() {
  const { locationId } = useClientContext();
  return <EmailSetupForm locationId={locationId} />;
}
