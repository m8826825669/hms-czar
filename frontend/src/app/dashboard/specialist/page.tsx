"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, UserCog, Stethoscope, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { specialistApi } from "@/lib/api/hms";

export default function SpecialistDirectoryPage() {
  const [query, setQuery] = useState("");

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors", query],
    queryFn: () => specialistApi.listDoctors({ search: query }),
  });

  const { data: specialtiesData } = useQuery({
    queryKey: ["specialties"],
    queryFn: () => specialistApi.listSpecialties(),
  });

  const doctors = doctorsData?.results ?? [];
  const specialties = specialtiesData?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Specialists / Doctors</h2>
          <p className="text-muted-foreground">
            Doctor directory · slots · fees · on-call roster
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/specialist/new">
            <UserCog className="mr-2 h-4 w-4" />Add Doctor
          </Link>
        </Button>
      </div>

      {/* Specialty cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {specialties.slice(0, 8).map((s) => {
          const count = doctors.filter((d) => d.specialty_names.includes(s.name)).length;
          return (
            <Card key={s.id} className="cursor-pointer transition-shadow hover:shadow-sm"
              onClick={() => setQuery(s.name)}>
              <CardContent className="flex items-center gap-3 p-4">
                <Stethoscope className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{count} doctor(s)</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, registration number, or specialty…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{doctors.length} doctor(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {doctors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No doctors found. Run <code className="rounded bg-muted px-1">python manage.py seed_phase1</code> to populate sample doctors.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {doctors.map((d) => (
                <Link key={d.id} href={`/dashboard/specialist/${d.id}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{d.full_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {d.registration_number}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {d.is_consulting ? (
                            <Badge variant="success">Consulting</Badge>
                          ) : (
                            <Badge variant="secondary">Off</Badge>
                          )}
                        </div>
                      </div>
                      {d.specialty_names.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.specialty_names.map((s) => (
                            <Badge key={s} variant="info">{s}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {d.qualification_codes.length > 0 && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {d.qualification_codes.join(", ")}
                          </span>
                        )}
                        <span>{d.years_of_experience} yrs exp</span>
                        {d.languages.length > 0 && (
                          <span>{d.languages.join(", ")}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
