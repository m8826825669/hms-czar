"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Pill, Calendar, Phone, MapPin, Stethoscope, AlertCircle, Printer } from "lucide-react";
import { publicApi } from "@/lib/api/billing";

export default function PublicRxPage() {
  const { uuid } = useParams<{ uuid: string }>();

  const { data: rx, isLoading, error } = useQuery({
    queryKey: ["public-rx", uuid],
    queryFn: () => publicApi.prescription(uuid),
    enabled: !!uuid,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading prescription…</p>
      </div>
    );
  }

  if (error || !rx) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Prescription Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link or QR code may be invalid or expired. Please check with your doctor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
      {/* Top bar - hidden in print */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-xs text-muted-foreground">Prescription view</span>
        <button onClick={() => window.print()}
          className="flex items-center gap-1 rounded border px-3 py-1 text-xs hover:bg-muted">
          <Printer className="h-3 w-3" />Print
        </button>
      </div>

      {/* Header — hospital block */}
      <div className="border-b-2 border-primary pb-4 text-center">
        <h1 className="text-2xl font-bold">{rx.hospital.name}</h1>
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 text-xs text-muted-foreground">
          {rx.hospital.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />{rx.hospital.city}
            </span>
          )}
          {rx.hospital.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />{rx.hospital.phone}
            </span>
          )}
        </div>
      </div>

      {/* Doctor + Patient — 2 columns */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-b pb-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Patient</div>
          <div className="mt-1 font-semibold">{rx.patient.name}</div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">{rx.patient.mrn}</span> · {rx.patient.age}{rx.patient.gender}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Doctor</div>
          <div className="mt-1 font-semibold flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{rx.doctor.name}
          </div>
          <div className="text-xs text-muted-foreground">
            Reg: {rx.doctor.registration_number}
            {rx.doctor.qualifications.length > 0 && ` · ${rx.doctor.qualifications.join(", ")}`}
          </div>
        </div>
      </div>

      {/* Rx meta */}
      <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono font-bold">{rx.code}</span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(rx.prescribed_at).toLocaleString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>

      {/* Diagnoses */}
      {rx.consultation.diagnoses.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Diagnosis</h2>
          <div className="mt-2 space-y-1">
            {rx.consultation.diagnoses.map((d, i) => (
              <div key={i} className="text-sm">
                <span className={d.is_primary ? "font-semibold" : ""}>{d.text}</span>
                {d.icd10 && (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">[{d.icd10}]</span>
                )}
                {!d.is_primary && (
                  <span className="ml-2 text-xs text-muted-foreground">({d.type})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drug list - the Rx body */}
      <div className="mt-6">
        <div className="flex items-center gap-2 border-b border-primary pb-1">
          <span className="font-serif text-2xl italic">℞</span>
          <h2 className="text-sm font-bold uppercase">Medications</h2>
        </div>

        {rx.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No medications prescribed.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {rx.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 font-mono text-sm font-bold">{i + 1}.</span>
                <div className="flex-1">
                  <div className="font-semibold">
                    {item.drug_name}
                    {item.is_continued && (
                      <span className="ml-2 text-xs italic text-muted-foreground">(continued)</span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="font-mono">{item.dose}</span>
                    {" · "}
                    <span>{item.frequency}</span>
                    {" · "}
                    <span>{item.duration_days} days</span>
                    {item.route !== "ORAL" && (
                      <>
                        {" · "}
                        <span className="text-xs uppercase">{item.route}</span>
                      </>
                    )}
                  </div>
                  {item.instructions && (
                    <div className="text-xs italic text-muted-foreground">
                      {item.instructions}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* General instructions */}
      {rx.general_instructions && (
        <div className="mt-6 rounded border-l-4 border-primary bg-muted/30 p-3">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Instructions</h3>
          <p className="mt-1 whitespace-pre-line text-sm">{rx.general_instructions}</p>
        </div>
      )}

      {/* Follow-up */}
      {rx.next_followup_days && (
        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Follow-up: </span>
          <span className="font-semibold">in {rx.next_followup_days} days</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 border-t pt-3 text-center text-xs text-muted-foreground">
        <p>This is a digitally generated prescription.</p>
        {!rx.is_signed && (
          <p className="mt-1 italic">Pending doctor's signature.</p>
        )}
        <p className="mt-1">For verification, scan QR or visit hospital reception.</p>
      </div>
    </div>
  );
}
