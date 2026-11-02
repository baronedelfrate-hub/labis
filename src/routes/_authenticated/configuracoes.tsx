import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { BarcodeSectorsCard } from "@/components/BarcodeSectorsCard";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Configurações — LIS" }] }),
  component: SettingsPage,
});

type Settings = {
  legal_name: string; address: string; city: string; state: string; zip_code: string;
  phone: string; email: string; cnpj: string; cnes: string;
  responsible_tech_name: string; responsible_tech_council: string; footer_note: string;
  logo_url: string | null;
};

const empty: Settings = {
  legal_name: "", address: "", city: "", state: "", zip_code: "",
  phone: "", email: "", cnpj: "", cnes: "",
  responsible_tech_name: "", responsible_tech_council: "", footer_note: "",
  logo_url: null,
};

function SettingsPage() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["company-settings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").eq("company_id", companyId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        legal_name: data.legal_name ?? "", address: data.address ?? "", city: data.city ?? "",
        state: data.state ?? "", zip_code: data.zip_code ?? "", phone: data.phone ?? "",
        email: data.email ?? "", cnpj: data.cnpj ?? "", cnes: data.cnes ?? "",
        responsible_tech_name: data.responsible_tech_name ?? "",
        responsible_tech_council: data.responsible_tech_council ?? "",
        footer_note: data.footer_note ?? "", logo_url: data.logo_url ?? null,
      });
    }
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!form.logo_url) { setLogoPreview(null); return; }
      const { data } = await supabase.storage.from("company-logos").createSignedUrl(form.logo_url, 3600);
      if (!cancelled) setLogoPreview(data?.signedUrl ?? null);
    }
    loadPreview();
    return () => { cancelled = true; };
  }, [form.logo_url]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${companyId}/logo.${ext}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setForm((f) => ({ ...f, logo_url: path }));
      toast.success("Logo enviado");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = { company_id: companyId, ...form };
      const { error } = await supabase.from("company_settings").upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Configurações do laudo" description="Dados da empresa exibidos no cabeçalho e rodapé do laudo" actions={
        <Button onClick={handleSave} disabled={saving || isLoading}>{saving && <Loader2 className="size-4 mr-1 animate-spin" />}Salvar</Button>
      } />
      <PageBody>
        <div className="grid gap-6 max-w-4xl">
          <div className="rounded-md border bg-card p-4">
            <div className="text-sm font-medium mb-3">Logo</div>
            <div className="flex items-center gap-4">
              <div className="size-24 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
                {logoPreview ? <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logo</span>}
              </div>
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                <Button asChild variant="outline" disabled={uploading}>
                  <span className="cursor-pointer">{uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}Enviar logo</span>
                </Button>
              </label>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-medium">Identificação</div>
            <Field label="Razão social"><Input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNPJ"><Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></Field>
              <Field label="CNES"><Input value={form.cnes} onChange={e => setForm({ ...form, cnes: e.target.value })} /></Field>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-medium">Endereço e contato</div>
            <Field label="Endereço"><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Field label="Cidade"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field></div>
              <Field label="UF"><Input maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP"><Input value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="E-mail"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-medium">Responsável técnico</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome"><Input value={form.responsible_tech_name} onChange={e => setForm({ ...form, responsible_tech_name: e.target.value })} /></Field>
              <Field label="Conselho"><Input placeholder="CRBM/CRF/CRM etc." value={form.responsible_tech_council} onChange={e => setForm({ ...form, responsible_tech_council: e.target.value })} /></Field>
            </div>
            <Field label="Rodapé (texto adicional)"><Textarea rows={2} value={form.footer_note} onChange={e => setForm({ ...form, footer_note: e.target.value })} /></Field>
          </div>

          <BarcodeSectorsCard />
        </div>
      </PageBody>
    </>
  );
}
