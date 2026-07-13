"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type PaperFilters = {
  years: number[];
  provinces: string[];
  examTypes: string[];
};

type PaperFilterQuery = {
  year?: number;
  province?: string;
  examType?: string;
};

function selectClassName() {
  return "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-8 lg:px-2.5 lg:text-sm";
}

export function PaperFilterForm({
  query,
  filters,
  vertical = false,
  idPrefix,
}: {
  query: PaperFilterQuery;
  filters: PaperFilters;
  vertical?: boolean;
  idPrefix: string;
}) {
  const router = useRouter();
  const hasActiveFilters = Boolean(query.year || query.province || query.examType);

  function submitOnChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;
    if (!form) return;

    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["year", "province", "examType"] as const) {
      const value = formData.get(key);
      if (typeof value === "string" && value) params.set(key, value);
    }
    const queryString = params.toString();
    router.push(`/question-bank/papers${queryString ? `?${queryString}` : ""}`);
  }

  return (
    <form className={cn("grid gap-4", !vertical && "md:grid-cols-3 md:items-end")}>
      <FieldGroup className={cn("grid gap-4", !vertical && "md:contents")}>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-year`}>年份</FieldLabel>
          <select id={`${idPrefix}-year`} name="year" defaultValue={query.year ?? ""} className={selectClassName()} onChange={submitOnChange}>
            <option value="">全部年份</option>
            {filters.years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-province`}>地区</FieldLabel>
          <select id={`${idPrefix}-province`} name="province" defaultValue={query.province ?? ""} className={selectClassName()} onChange={submitOnChange}>
            <option value="">全部地区</option>
            {filters.provinces.map((province) => <option key={province} value={province}>{province}</option>)}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-examType`}>类型</FieldLabel>
          <select id={`${idPrefix}-examType`} name="examType" defaultValue={query.examType ?? ""} className={selectClassName()} onChange={submitOnChange}>
            <option value="">全部类型</option>
            {filters.examTypes.map((examType) => <option key={examType} value={examType}>{examType}</option>)}
          </select>
        </Field>
      </FieldGroup>
      {hasActiveFilters ? (
        <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}>
          清除筛选
        </Link>
      ) : null}
    </form>
  );
}
