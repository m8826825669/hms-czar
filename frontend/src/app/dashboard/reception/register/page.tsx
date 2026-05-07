"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { patientsApi } from "@/lib/api/hms";

const schema = z.object({
  first_name: z.string().min(1, "First name required"),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  dob: z.string().min(1, "DOB required"),
  gender: z.enum(["M", "F", "O"]),
  blood_group: z.string().default("UNK"),
  phone: z.string().min(10, "Valid phone required"),
  alt_phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  aadhaar_last4: z.string().max(4).optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relation: z.string().optional(),
  occupation: z.string().optional(),
  allergies_text: z.string().optional(),
  chronic_conditions_text: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function PatientRegistrationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "M", blood_group: "UNK" },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const allergies = (data.allergies_text || "")
        .split(",").map((s) => s.trim()).filter(Boolean)
        .map((substance) => ({ substance, severity: "unknown" }));
      const chronic = (data.chronic_conditions_text || "")
        .split(",").map((s) => s.trim()).filter(Boolean);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { allergies_text, chronic_conditions_text, ...rest } = data;
      const patient = await patientsApi.create({
        ...rest,
        allergies, chronic_conditions: chronic,
      } as never);
      toast.success(`Registered ${patient.full_name} (${patient.mrn})`);
      router.push(`/dashboard/reception/search?mrn=${patient.mrn}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: Record<string, unknown> } };
      toast.error(JSON.stringify(err?.response?.data ?? "Registration failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/reception"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Patient Registration</h2>
          <p className="text-sm text-muted-foreground">
            MRN auto-generated; required fields marked
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input {...register("first_name")} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Middle Name</Label>
              <Input {...register("middle_name")} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register("last_name")} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth *</Label>
              <Input type="date" {...register("dob")} />
              {errors.dob && <p className="text-xs text-destructive">{errors.dob.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select {...register("gender")}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select {...register("blood_group")}>
                {["UNK", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Occupation</Label>
              <Input {...register("occupation")} placeholder="Teacher, Engineer, ..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Mobile *</Label>
              <Input {...register("phone")} placeholder="+919876543210" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alt Mobile</Label>
              <Input {...register("alt_phone")} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
            </div>
            <div className="space-y-2">
              <Label>Aadhaar Last 4</Label>
              <Input maxLength={4} {...register("aadhaar_last4")} placeholder="1234" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input {...register("address_line1")} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input {...register("city")} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input {...register("state")} />
            </div>
            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input {...register("pincode")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...register("emergency_contact_name")} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("emergency_contact_phone")} />
            </div>
            <div className="space-y-2">
              <Label>Relation</Label>
              <Input {...register("emergency_contact_relation")} placeholder="Father / Spouse / ..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Medical History</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Allergies (comma-separated)</Label>
              <Textarea {...register("allergies_text")}
                placeholder="Penicillin, Peanuts, Sulfa drugs" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Chronic Conditions (comma-separated)</Label>
              <Textarea {...register("chronic_conditions_text")}
                placeholder="Diabetes, Hypertension" rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/reception">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            {submitting ? "Registering…" : "Register Patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
