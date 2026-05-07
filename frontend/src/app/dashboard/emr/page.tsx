"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, AlertTriangle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patientsApi } from "@/lib/api/hms";

export default function EMRSearchPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["patients", "search-emr", debounced],
    queryFn: () => patientsApi.list({ search: debounced }),
  });

  const patients = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6" />Electronic Medical Records
        </h2>
        <p className="text-muted-foreground">
          Search a patient to view their 360° clinical record
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus
              placeholder="MRN / Name / Phone / ABHA…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{debounced ? `${data?.count ?? 0} result(s)` : "Search to begin"}</CardTitle>
        </CardHeader>
        <CardContent>
          {patients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {debounced ? "No patients found." : "Type a name, MRN, or phone number."}
            </p>
          ) : (
            <div className="divide-y">
              {patients.map((p) => (
                <Link href={`/dashboard/emr/${p.id}`} key={p.id}
                  className="flex items-center justify-between gap-4 py-3 hover:bg-muted/40">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.full_name}</span>
                      {p.is_vip && <Badge variant="warning">VIP</Badge>}
                      {p.is_deceased && <Badge variant="destructive">Deceased</Badge>}
                      {p.allergies.length > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {p.allergies.length} allergy
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      <span className="font-mono">{p.mrn}</span>
                      <span>{p.age}{p.gender}</span>
                      <span>{p.blood_group}</span>
                      <span>{p.phone}</span>
                    </div>
                  </div>
                  <span className="text-xs text-primary">View 360° →</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
