"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, UserPlus, Phone, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patientsApi } from "@/lib/api/hms";

export default function PatientSearchPage() {
  const params = useSearchParams();
  const initial = params.get("mrn") || params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["patients", "search", debounced],
    queryFn: () => patientsApi.list({ search: debounced }),
    enabled: true,
  });

  const patients = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Patient Search</h2>
          <p className="text-muted-foreground">
            Search by MRN, name, phone, or ABHA ID
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/reception/register">
            <UserPlus className="mr-2 h-4 w-4" />Register New
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="MRN / Name / Phone / ABHA…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {isFetching ? "Searching…" : `${data?.count ?? 0} result(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {debounced ? "No patients found." : "Type to search…"}
            </p>
          ) : (
            <div className="divide-y">
              {patients.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.full_name}</span>
                      {p.is_vip && <Badge variant="warning">VIP</Badge>}
                      {p.is_deceased && <Badge variant="destructive">Deceased</Badge>}
                      {p.allergies.length > 0 && (
                        <Badge variant="destructive">⚠ Allergies</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{p.mrn}</span>
                      <span>{p.age} {p.gender === "M" ? "M" : p.gender === "F" ? "F" : "O"}</span>
                      <span>{p.blood_group}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>
                      {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                      {p.city && <span>{p.city}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/reception/appointments/new?patient=${p.id}`}>
                        Book
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
